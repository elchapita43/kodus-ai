import { CodyLearningCronProvider } from './codyLearning.cron';

/**
 * Covers the per-repo window partition added for issue #1506: a repo that has
 * never produced past-review rules gets the one-time 3-month backfill (guarded
 * by a per-repo lock), every other enabled repo gets the weekly (1-week) delta.
 */
function build(opts: {
    repoIds: string[];
    seeded: (repoId: string) => boolean;
    // Seeded status seen on the under-lock re-check (2nd call onwards).
    // Defaults to `seeded` — set it to model a repo seeded by a concurrent
    // config-save between the pre-lock check and acquiring its lock.
    seededAfterLock?: (repoId: string) => boolean;
    lockAcquired?: (repoId: string) => boolean;
    acquireThrows?: (repoId: string) => boolean;
}) {
    const parametersService = {
        findByKey: jest.fn().mockResolvedValue({
            configValue: {
                configs: {},
                repositories: opts.repoIds.map((id) => ({
                    id,
                    isSelected: true,
                    configs: {},
                })),
            },
        }),
    } as any;

    const generateCodyRulesUseCase = {
        execute: jest.fn().mockResolvedValue(undefined),
    } as any;

    let seededCallCount = 0;
    const generateInitialCodyRulesUseCase = {
        hasPastReviewRulesForRepos: jest.fn(
            (_org: string, repoIds: string[]) => {
                const predicate =
                    seededCallCount++ === 0
                        ? opts.seeded
                        : (opts.seededAfterLock ?? opts.seeded);
                return Promise.resolve(new Set(repoIds.filter(predicate)));
            },
        ),
    } as any;

    const releasedLocks: string[] = [];
    const distributedLockService = {
        acquire: jest.fn((key: string) => {
            const repoId = key.split(':').pop() as string;
            if (opts.acquireThrows?.(repoId)) {
                return Promise.reject(new Error(`acquire failed for ${repoId}`));
            }
            const acquired = opts.lockAcquired ? opts.lockAcquired(repoId) : true;
            return Promise.resolve(
                acquired
                    ? {
                          release: jest.fn(() => {
                              releasedLocks.push(repoId);
                              return Promise.resolve(undefined);
                          }),
                      }
                    : null,
            );
        }),
    } as any;

    const cron = new CodyLearningCronProvider(
        {} as any,
        parametersService,
        generateCodyRulesUseCase,
        generateInitialCodyRulesUseCase,
        distributedLockService,
    );

    return {
        cron,
        generateCodyRulesUseCase,
        generateInitialCodyRulesUseCase,
        distributedLockService,
        releasedLocks,
    };
}

const run = (cron: CodyLearningCronProvider) =>
    (cron as any).generateCodyRules({
        organizationId: 'org-1',
        teamId: 'team-1',
    });

describe('CodyLearningCronProvider — per-repo backfill window', () => {
    it('uses a 3-month window for repos with no past-review rules yet', async () => {
        const { cron, generateCodyRulesUseCase } = build({
            repoIds: ['r1'],
            seeded: () => false,
        });

        await run(cron);

        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledTimes(1);
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', months: 3, repositoriesIds: ['r1'] },
            'org-1',
        );
    });

    it('uses the 1-week window once a repo already has past-review rules', async () => {
        const { cron, generateCodyRulesUseCase } = build({
            repoIds: ['r1'],
            seeded: () => true,
        });

        await run(cron);

        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledTimes(1);
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', weeks: 1, repositoriesIds: ['r1'] },
            'org-1',
        );
    });

    it('checks the whole team with a single query, not one per repo', async () => {
        const { cron, generateInitialCodyRulesUseCase } = build({
            repoIds: ['a', 'b', 'c'],
            seeded: () => true,
        });

        await run(cron);

        expect(
            generateInitialCodyRulesUseCase.hasPastReviewRulesForRepos,
        ).toHaveBeenCalledTimes(1);
        expect(
            generateInitialCodyRulesUseCase.hasPastReviewRulesForRepos,
        ).toHaveBeenCalledWith('org-1', ['a', 'b', 'c']);
    });

    it('splits a mixed set into one 3-month batch and one 1-week batch', async () => {
        const { cron, generateCodyRulesUseCase } = build({
            repoIds: ['fresh', 'seeded'],
            seeded: (id) => id === 'seeded',
        });

        await run(cron);

        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', months: 3, repositoriesIds: ['fresh'] },
            'org-1',
        );
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', weeks: 1, repositoriesIds: ['seeded'] },
            'org-1',
        );
    });

    it('locks each backfilled repo and releases it after generation', async () => {
        const { cron, distributedLockService, releasedLocks } = build({
            repoIds: ['fresh'],
            seeded: () => false,
        });

        await run(cron);

        expect(distributedLockService.acquire).toHaveBeenCalledWith(
            'CODY_RULES:INITIAL_GEN:org-1:fresh',
            expect.objectContaining({ ttl: expect.any(Number) }),
        );
        expect(releasedLocks).toEqual(['fresh']);
    });

    it('skips a backfill repo whose lock is already held elsewhere', async () => {
        const { cron, generateCodyRulesUseCase } = build({
            repoIds: ['fresh', 'contended'],
            seeded: () => false,
            lockAcquired: (id) => id !== 'contended',
        });

        await run(cron);

        // Only the repo whose lock we acquired gets a 3-month run.
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledTimes(1);
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', months: 3, repositoriesIds: ['fresh'] },
            'org-1',
        );
    });

    it('re-checks under the lock and skips a repo seeded since the pre-lock check', async () => {
        // 'raced' looks unseeded pre-lock but a concurrent config-save seeds it
        // before the cron acquires its lock — it must NOT be backfilled again.
        const { cron, generateCodyRulesUseCase, releasedLocks } = build({
            repoIds: ['fresh', 'raced'],
            seeded: () => false,
            seededAfterLock: (id) => id === 'raced',
        });

        await run(cron);

        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledTimes(1);
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', months: 3, repositoriesIds: ['fresh'] },
            'org-1',
        );
        // Both locks were still acquired and released even though 'raced' was skipped.
        expect(releasedLocks.sort()).toEqual(['fresh', 'raced']);
    });

    it('does not run a 3-month backfill when every repo was seeded since the pre-lock check', async () => {
        const { cron, generateCodyRulesUseCase } = build({
            repoIds: ['raced'],
            seeded: () => false,
            seededAfterLock: () => true,
        });

        await run(cron);

        expect(generateCodyRulesUseCase.execute).not.toHaveBeenCalled();
    });

    it('releases already-held locks when acquiring one repo throws', async () => {
        const { cron, generateCodyRulesUseCase, releasedLocks } = build({
            repoIds: ['a', 'b', 'c'],
            seeded: () => false,
            acquireThrows: (id) => id === 'b',
        });

        await run(cron);

        // 'b' failed to lock and is skipped; 'a' and 'c' proceed and release.
        expect(releasedLocks.sort()).toEqual(['a', 'c']);
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', months: 3, repositoriesIds: ['a', 'c'] },
            'org-1',
        );
    });

    it('falls back to the weekly window when the past-review check fails', async () => {
        const { cron, generateCodyRulesUseCase, generateInitialCodyRulesUseCase } =
            build({ repoIds: ['r1'], seeded: () => true });
        generateInitialCodyRulesUseCase.hasPastReviewRulesForRepos.mockRejectedValue(
            new Error('mongo down'),
        );

        await run(cron);

        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledTimes(1);
        expect(generateCodyRulesUseCase.execute).toHaveBeenCalledWith(
            { teamId: 'team-1', weeks: 1, repositoriesIds: ['r1'] },
            'org-1',
        );
    });
});
