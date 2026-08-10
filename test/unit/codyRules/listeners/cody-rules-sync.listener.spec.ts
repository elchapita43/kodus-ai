import { CodyRulesSyncListener } from '@libs/codyRules/infrastructure/adapters/listeners/cody-rules-sync.listener';

jest.mock('@libs/core/log/logger', () => ({
    createLogger: () => ({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }),
}));

describe('CodyRulesSyncListener — handleIdeRulesSyncDisabled', () => {
    const organizationAndTeamData = {
        organizationId: 'org-1',
        teamId: 'team-1',
    };

    function buildListener() {
        const codyRulesSyncService = {
            syncFromChangedFiles: jest.fn().mockResolvedValue(undefined),
            purgeAllIdeSyncRulesForRepository: jest
                .fn()
                .mockResolvedValue(undefined),
            pauseAllIdeSyncRulesForRepository: jest
                .fn()
                .mockResolvedValue(undefined),
            resumeAllIdeSyncRulesForRepository: jest
                .fn()
                .mockResolvedValue(undefined),
        };
        const parametersService = {
            findByKey: jest.fn().mockResolvedValue(null),
        };
        const organizationParametersService = {
            findByKey: jest.fn().mockResolvedValue(null),
        };

        const dataSource = {
            // CREATE TABLE / DELETE sweep return [], the INSERT claim wins
            // by default (RETURNING one row).
            query: jest
                .fn()
                .mockImplementation((sql: string) =>
                    Promise.resolve(
                        sql.trimStart().startsWith('INSERT')
                            ? [{ claim_key: 'k' }]
                            : [],
                    ),
                ),
        };

        const listener = new CodyRulesSyncListener(
            codyRulesSyncService as any,
            parametersService as any,
            organizationParametersService as any,
            dataSource as any,
        );

        return { listener, codyRulesSyncService, dataSource };
    }

    it('action=delete purges IDE-synced rules', async () => {
        const { listener, codyRulesSyncService } = buildListener();

        await listener.handleIdeRulesSyncDisabled({
            organizationAndTeamData,
            repositoryId: 'repo-1',
            action: 'delete',
        });

        expect(
            codyRulesSyncService.purgeAllIdeSyncRulesForRepository,
        ).toHaveBeenCalledWith({
            organizationAndTeamData,
            repositoryId: 'repo-1',
        });
        expect(
            codyRulesSyncService.pauseAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
    });

    it('action=pause flips IDE-synced rules to PAUSED', async () => {
        const { listener, codyRulesSyncService } = buildListener();

        await listener.handleIdeRulesSyncDisabled({
            organizationAndTeamData,
            repositoryId: 'repo-1',
            action: 'pause',
        });

        expect(
            codyRulesSyncService.pauseAllIdeSyncRulesForRepository,
        ).toHaveBeenCalledWith({
            organizationAndTeamData,
            repositoryId: 'repo-1',
        });
        expect(
            codyRulesSyncService.purgeAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
    });

    it('action=keep is a no-op (rules stay ACTIVE)', async () => {
        const { listener, codyRulesSyncService } = buildListener();

        await listener.handleIdeRulesSyncDisabled({
            organizationAndTeamData,
            repositoryId: 'repo-1',
            action: 'keep',
        });

        expect(
            codyRulesSyncService.purgeAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
        expect(
            codyRulesSyncService.pauseAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
        expect(
            codyRulesSyncService.resumeAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
    });

    it('missing action defaults to keep (least destructive)', async () => {
        // REGRESSION GUARD: previously the listener always purged on this event,
        // which silently deleted rules when the user toggled IDE auto-sync off.
        // Defaulting to 'keep' ensures any caller that doesn't pass an explicit
        // action gets the safe behaviour.
        const { listener, codyRulesSyncService } = buildListener();

        await listener.handleIdeRulesSyncDisabled({
            organizationAndTeamData,
            repositoryId: 'repo-1',
        } as any);

        expect(
            codyRulesSyncService.purgeAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
        expect(
            codyRulesSyncService.pauseAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
    });

    it('ignores the event when repositoryId is missing', async () => {
        const { listener, codyRulesSyncService } = buildListener();

        await listener.handleIdeRulesSyncDisabled({
            organizationAndTeamData,
            repositoryId: undefined as any,
            action: 'delete',
        });

        expect(
            codyRulesSyncService.purgeAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
        expect(
            codyRulesSyncService.pauseAllIdeSyncRulesForRepository,
        ).not.toHaveBeenCalled();
    });

    describe('cross-process sync claim', () => {
        const mergedEvent = {
            merged: true,
            pullRequestNumber: 42,
            repository: { id: 'repo-1', name: 'tiny-url' },
            organizationAndTeamData: { organizationId: 'org-1' },
            files: [{ filename: '.cody/rules/x.md', status: 'added' }],
        } as any;

        it('runs the sync when this process wins the claim', async () => {
            const { listener, codyRulesSyncService } = buildListener();
            await listener.handlePullRequestClosedEvent(mergedEvent);
            expect(
                codyRulesSyncService.syncFromChangedFiles,
            ).toHaveBeenCalledTimes(1);
        });

        it('skips the sync when another process already claimed the merge', async () => {
            const { listener, codyRulesSyncService, dataSource } =
                buildListener();
            dataSource.query.mockImplementation((sql: string) =>
                Promise.resolve([]),
            );
            await listener.handlePullRequestClosedEvent(mergedEvent);
            expect(
                codyRulesSyncService.syncFromChangedFiles,
            ).not.toHaveBeenCalled();
        });

        it('proceeds when the claim infrastructure errors (availability over exactly-once)', async () => {
            const { listener, codyRulesSyncService, dataSource } =
                buildListener();
            dataSource.query.mockRejectedValue(new Error('pg down'));
            await listener.handlePullRequestClosedEvent(mergedEvent);
            expect(
                codyRulesSyncService.syncFromChangedFiles,
            ).toHaveBeenCalledTimes(1);
        });
    });
});
