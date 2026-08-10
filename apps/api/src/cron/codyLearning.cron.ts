import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { deepMerge } from '@libs/common/utils/deep';
import { getDefaultCodusConfigFile } from '@libs/common/utils/validateCodeReviewConfigFile';
import { IntegrationCategory } from '@libs/core/domain/enums/integration-category.enum';
import { ParametersKey } from '@libs/core/domain/enums/parameters-key.enum';
import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { GenerateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/generate-cody-rules.use-case';
import {
    GenerateInitialCodyRulesUseCase,
    INITIAL_GENERATION_LOCK_TTL_MS,
} from '@libs/codyRules/application/use-cases/generate-initial-cody-rules.use-case';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { CodyLearningStatus } from '@libs/organization/domain/parameters/types/configValue.type';
import {
    TEAM_SERVICE_TOKEN,
    ITeamService,
} from '@libs/organization/domain/team/contracts/team.service.contract';
import { IntegrationStatusFilter } from '@libs/organization/domain/team/interfaces/team.interface';
import {
    DistributedLock,
    DistributedLockService,
} from '@libs/core/workflow/infrastructure/distributed-lock.service';

import {
    hasExhaustedStuckRetries,
    isCodyLearningStatusStale,
} from './cody-learning-staleness';

const CRON_CODY_LEARNING = process.env.API_CRON_CODY_LEARNING;

@Injectable()
export class CodyLearningCronProvider {
    private readonly logger = createLogger(CodyLearningCronProvider.name);
    constructor(
        @Inject(TEAM_SERVICE_TOKEN)
        private readonly teamService: ITeamService,
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
        private readonly generateCodyRulesUseCase: GenerateCodyRulesUseCase,
        private readonly generateInitialCodyRulesUseCase: GenerateInitialCodyRulesUseCase,
        private readonly distributedLockService: DistributedLockService,
    ) {}

    @Cron(CRON_CODY_LEARNING, {
        name: 'Cody Learning',
        timeZone: 'America/Sao_Paulo',
    })
    async handleCron() {
        // We run many app instances; the @Cron fires on every one. Acquire a
        // distributed lock so only a single instance runs the sweep.
        const lockKey = 'CRON:CODY_LEARNING';

        let lock: DistributedLock;
        try {
            lock = await this.distributedLockService.acquire(lockKey, {
                // Released in `finally` on a normal run — the TTL is only the
                // safety net if the holding instance crashes mid-sweep.
                ttl: 1000 * 60 * 30,
            });

            if (!lock) {
                this.logger.log({
                    message: 'Cron execution skipped - Lock already acquired',
                    context: CodyLearningCronProvider.name,
                    metadata: { lockKey },
                });
                return;
            }
        } catch (error) {
            this.logger.error({
                message: 'Error acquiring distributed lock for cron execution',
                context: CodyLearningCronProvider.name,
                metadata: { lockKey },
                error,
            });
            return;
        }

        try {
            this.logger.log({
                message: 'Cody Rules generator cron started',
                context: CodyLearningCronProvider.name,
                metadata: {
                    timestamp: new Date().toISOString(),
                },
            });

            const teams = await this.teamService.findTeamsWithIntegrations({
                integrationCategories: [IntegrationCategory.CODE_MANAGEMENT],
                integrationStatus: IntegrationStatusFilter.CONFIGURED,
                status: STATUS.ACTIVE,
            });

            if (!teams || teams.length === 0) {
                this.logger.log({
                    message: 'No teams found',
                    context: CodyLearningCronProvider.name,
                    metadata: {
                        timestamp: new Date().toISOString(),
                    },
                });

                return;
            }

            for (const team of teams) {
                const organizationId = team.organization?.uuid;
                const teamId = team.uuid;

                const platformConfigs = await this.parametersService.findByKey(
                    ParametersKey.PLATFORM_CONFIGS,
                    { organizationId, teamId },
                );

                if (!platformConfigs) {
                    this.logger.error({
                        message: 'Platform configs not found',
                        context: CodyLearningCronProvider.name,
                        metadata: {
                            teamId,
                            timestamp: new Date().toISOString(),
                        },
                    });

                    continue;
                }

                const codyLearningStatus =
                    platformConfigs.configValue.codyLearningStatus;

                if (
                    !codyLearningStatus ||
                    codyLearningStatus === CodyLearningStatus.DISABLED
                ) {
                    this.logger.log({
                        message: 'Cody learning is disabled',
                        context: CodyLearningCronProvider.name,
                        metadata: {
                            teamId,
                            timestamp: new Date().toISOString(),
                        },
                    });

                    continue;
                }

                if (
                    codyLearningStatus ===
                        CodyLearningStatus.GENERATING_CONFIG ||
                    codyLearningStatus === CodyLearningStatus.GENERATING_RULES
                ) {
                    // A `generating_*` status can be stale: rule generation
                    // runs detached, so an API restart mid-run leaves a team
                    // stuck. A fresh status is a genuine in-progress run —
                    // skip it; an old one is a dead run we should restart.
                    if (
                        !isCodyLearningStatusStale(
                            codyLearningStatus,
                            platformConfigs.updatedAt,
                        )
                    ) {
                        this.logger.log({
                            message: 'Cody learning is already generating',
                            context: CodyLearningCronProvider.name,
                            metadata: {
                                teamId,
                                timestamp: new Date().toISOString(),
                            },
                        });

                        continue;
                    }

                    // A stuck run that keeps hard-crashing must not be
                    // retried forever — give up after MAX_STUCK_RETRIES so
                    // the cron stops re-crashing the process every tick.
                    if (
                        hasExhaustedStuckRetries(
                            platformConfigs.configValue
                                .codyLearningStuckRetries,
                        )
                    ) {
                        this.logger.error({
                            message:
                                'Cody learning stuck and exhausted retries — giving up',
                            context: CodyLearningCronProvider.name,
                            metadata: {
                                teamId,
                                codyLearningStatus,
                                stuckRetries:
                                    platformConfigs.configValue
                                        .codyLearningStuckRetries,
                                timestamp: new Date().toISOString(),
                            },
                        });

                        continue;
                    }

                    this.logger.warn({
                        message:
                            'Cody learning stuck in a generating state — regenerating',
                        context: CodyLearningCronProvider.name,
                        metadata: {
                            teamId,
                            codyLearningStatus,
                            stuckRetries:
                                platformConfigs.configValue
                                    .codyLearningStuckRetries,
                            timestamp: new Date().toISOString(),
                        },
                    });
                }

                await this.generateCodyRules({ organizationId, teamId });
            }
        } catch (error) {
            this.logger.error({
                message: 'Error in Cody Rules generator cron',
                context: CodyLearningCronProvider.name,
                error,
                metadata: {
                    timestamp: new Date().toISOString(),
                },
            });
        } finally {
            try {
                await lock.release();
            } catch (error) {
                this.logger.error({
                    message:
                        'Error releasing distributed lock after cron execution',
                    context: CodyLearningCronProvider.name,
                    metadata: { lockKey },
                    error,
                });
            }
        }
    }

    private async generateCodyRules(params: {
        organizationId: string;
        teamId: string;
    }) {
        try {
            const { organizationId, teamId } = params;
            const codeReviewConfig = await this.parametersService.findByKey(
                ParametersKey.CODE_REVIEW_CONFIG,
                { organizationId, teamId },
            );

            if (!codeReviewConfig || !codeReviewConfig.configValue) {
                this.logger.error({
                    message: 'Code review config not found',
                    context: CodyLearningCronProvider.name,
                    metadata: {
                        organizationId,
                        teamId,
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }

            const repos = codeReviewConfig.configValue.repositories;

            if (!repos || repos.length === 0) {
                this.logger.error({
                    message: 'No repositories found',
                    context: CodyLearningCronProvider.name,
                    metadata: {
                        organizationId,
                        teamId,
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }

            const defaultConfig = getDefaultCodusConfigFile();
            const resolvedGlobalConfig = deepMerge(
                defaultConfig,
                codeReviewConfig.configValue.configs ?? {},
            );

            // Repos whose resolved config has the generator enabled. Note this
            // does NOT gate on isSelected: right after onboarding repos sit in
            // the config with isSelected=false, and requiring it here meant the
            // cron never generated for a fresh team.
            const enabledRepos = repos.filter((repo) => {
                const resolvedRepoConfig = deepMerge(
                    resolvedGlobalConfig,
                    repo.configs ?? {},
                );

                return (
                    (resolvedRepoConfig as any)?.codyRulesGeneratorEnabled ===
                    true
                );
            });

            if (enabledRepos.length === 0) {
                this.logger.log({
                    message: 'Cody rules generator is disabled',
                    context: CodyLearningCronProvider.name,
                    metadata: {
                        organizationId,
                        teamId,
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }

            // A repo that has never produced past-review rules (e.g. its owner
            // skipped onboarding) still needs the one-time 3-month backfill the
            // onboarding flow used to do; every other repo just needs the last
            // week's delta. Partition the repos with a single lookup and run
            // each window once (issue #1506).
            const repoIds = enabledRepos.map((repo) => repo.id);

            let seededRepoIds: Set<string>;
            try {
                seededRepoIds =
                    await this.generateInitialCodyRulesUseCase.hasPastReviewRulesForRepos(
                        organizationId,
                        repoIds,
                    );
            } catch (error) {
                // On a lookup failure, treat every repo as already seeded so we
                // fall back to the cheaper weekly window rather than risk an
                // unexpected 3-month run.
                this.logger.error({
                    message:
                        'Failed to check past-review rules; using weekly window for all repos',
                    context: CodyLearningCronProvider.name,
                    error,
                    metadata: { organizationId, teamId },
                });
                seededRepoIds = new Set(repoIds);
            }

            const backfillRepoIds = repoIds.filter(
                (id) => !seededRepoIds.has(id),
            );
            const weeklyRepoIds = repoIds.filter((id) => seededRepoIds.has(id));

            if (weeklyRepoIds.length > 0) {
                await this.generateCodyRulesUseCase.execute(
                    {
                        teamId,
                        weeks: 1,
                        repositoriesIds: weeklyRepoIds,
                    },
                    organizationId,
                );
            }

            // Hold a per-repo lock across the backfill so a concurrent
            // config-save seed of the same repo can't run at the same time and
            // duplicate its rules. Repos already being seeded elsewhere are
            // skipped this run and picked up on the next.
            const heldLocks: DistributedLock[] = [];
            const lockedBackfillIds: string[] = [];

            try {
                for (const repoId of backfillRepoIds) {
                    let lock: DistributedLock | null = null;
                    try {
                        lock = await this.distributedLockService.acquire(
                            GenerateInitialCodyRulesUseCase.initialGenerationLockKey(
                                organizationId,
                                repoId,
                            ),
                            { ttl: INITIAL_GENERATION_LOCK_TTL_MS },
                        );
                    } catch (error) {
                        // A lock failure for one repo must not abort the batch
                        // or leak the locks already held — skip it and let the
                        // finally release the rest.
                        this.logger.error({
                            message:
                                'Failed to acquire backfill lock; skipping repo',
                            context: CodyLearningCronProvider.name,
                            error,
                            metadata: { organizationId, teamId, repoId },
                        });
                        continue;
                    }

                    if (lock) {
                        heldLocks.push(lock);
                        lockedBackfillIds.push(repoId);
                    }
                }

                if (lockedBackfillIds.length > 0) {
                    // Re-check under the locks: a config-save seed may have
                    // finished between the pre-lock check and now. Skip any
                    // repo that became seeded so we don't generate duplicate
                    // past-review rules. If the re-check itself fails, skip the
                    // backfill this run rather than risk duplicates.
                    let nowSeeded: Set<string>;
                    try {
                        nowSeeded =
                            await this.generateInitialCodyRulesUseCase.hasPastReviewRulesForRepos(
                                organizationId,
                                lockedBackfillIds,
                            );
                    } catch (error) {
                        this.logger.error({
                            message:
                                'Failed to re-check past-review rules under lock; skipping backfill',
                            context: CodyLearningCronProvider.name,
                            error,
                            metadata: { organizationId, teamId },
                        });
                        nowSeeded = new Set(lockedBackfillIds);
                    }

                    const idsToBackfill = lockedBackfillIds.filter(
                        (id) => !nowSeeded.has(id),
                    );

                    if (idsToBackfill.length > 0) {
                        await this.generateCodyRulesUseCase.execute(
                            {
                                teamId,
                                months: 3,
                                repositoriesIds: idsToBackfill,
                            },
                            organizationId,
                        );
                    }
                }
            } finally {
                await Promise.allSettled(
                    heldLocks.map((lock) => lock.release()),
                );
            }
        } catch (error) {
            this.logger.error({
                message: 'Error generating cody rules',
                context: CodyLearningCronProvider.name,
                error,
                metadata: {
                    params,
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }
    }
}
