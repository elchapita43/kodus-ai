import { createLogger } from '@libs/core/log/logger';
import {
    CentralizedConfigPrService,
    CentralizedPrMetadata,
} from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PromptSourceType } from '@libs/ai-engine/domain/prompt/interfaces/promptExternalReference.interface';
import { ContextReferenceDetectionService } from '@libs/ai-engine/infrastructure/adapters/services/context/context-reference-detection.service';
import type { ContextDetectionField } from '@libs/ai-engine/infrastructure/adapters/services/context/context-reference-detection.service';
import { CreateCodyRuleDto } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import {
    buildCodyRuleCentralizedFilePath,
    buildCodyRuleCentralizedMutationRequest,
} from '@libs/centralized-config/utils/cody-rules-centralized-pr.builder';
import {
    CONTEXT_RESOLUTION_SERVICE_TOKEN,
    IContextResolutionService,
} from '@libs/core/context-resolution/domain/contracts/context-resolution.service.contract';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import { PermissionValidationService } from '@libs/ee/shared/services/permissionValidation.service';
import {
    ICodyRuleDetectorCompiler,
    CODY_RULE_DETECTOR_COMPILER_TOKEN,
} from '../../domain/contracts/cody-rule-detector-compiler.contract';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    ICodyRule,
    CodyRuleCentralizedStatus,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

@Injectable()
export class CreateOrUpdateCodyRulesUseCase {
    private readonly logger = createLogger(CreateOrUpdateCodyRulesUseCase.name);
    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
        @Inject(CONTEXT_RESOLUTION_SERVICE_TOKEN)
        private readonly contextResolutionService: IContextResolutionService,

        private readonly authorizationService: AuthorizationService,
        private readonly contextReferenceDetectionService: ContextReferenceDetectionService,
        private readonly centralizedConfigPrService: CentralizedConfigPrService,
        private readonly permissionValidationService: PermissionValidationService,
        @Inject(CODY_RULE_DETECTOR_COMPILER_TOKEN)
        private readonly detectorCompiler: ICodyRuleDetectorCompiler,
    ) {}

    async execute(
        codyRule: CreateCodyRuleDto,
        organizationId: string,
        userInfo?: { userId: string; userEmail: string },
        skipAuthorization?: boolean,
        teamIdOverride?: string,
        // The authenticated user, forwarded by the controller. Use-cases must
        // not inject REQUEST (it makes them request-scoped, which bubbles up
        // into singleton callers like event listeners and sync services).
        requestUser?: UserRequest['user'],
    ): Promise<Partial<any> | CentralizedPrMetadata> {
        try {
            const reqUser: any = requestUser;

            const organizationAndTeamData: OrganizationAndTeamData = {
                organizationId,
                teamId:
                    teamIdOverride || reqUser?.team?.uuid || reqUser?.teamId,
            };

            const userInfoData =
                userInfo ||
                (reqUser?.uuid && reqUser?.email
                    ? { userId: reqUser.uuid, userEmail: reqUser.email }
                    : { userId: 'cody-system', userEmail: 'cody@kodus.io' });

            // Centralized config is the source of truth for APPROVED rules
            // only. A rule persisted as PENDING (awaiting approval) or REJECTED
            // must not be routed into the rolling PR — it stays in the DB until
            // approved, at which point the apply/convert use-cases re-run this
            // flow with an active status and it exports normally.
            const isApprovedForCentralized =
                !codyRule.status ||
                codyRule.status === CodyRulesStatus.ACTIVE ||
                codyRule.status === CodyRulesStatus.PAUSED;

            const bypassCentralizedRouting =
                this.isInternalSyncActor(userInfoData) ||
                !isApprovedForCentralized;

            if (
                !skipAuthorization &&
                userInfoData.userId !== 'cody-system' &&
                requestUser
            ) {
                await this.authorizationService.ensure({
                    user: requestUser,
                    action: Action.Create,
                    resource: ResourceType.CodyRules,
                    repoIds: await this.resolveAuthorizationRepoIds(codyRule),
                });
            }

            if (!bypassCentralizedRouting) {
                const centralizedPr =
                    await this.createCentralizedMutationIfEnabled(
                        organizationAndTeamData,
                        codyRule,
                        userInfoData,
                    );

                if (centralizedPr) {
                    return centralizedPr;
                }

                const centralizedEnabledForScope =
                    await this.isCentralizedEnabledForRuleMutation(
                        organizationAndTeamData,
                        codyRule.repositoryId,
                    );

                if (centralizedEnabledForScope) {
                    throw new Error(
                        'Centralized config is enabled, but rule mutation was not routed through centralized PR flow',
                    );
                }
            }

            const result = await this.codyRulesService.createOrUpdate(
                organizationAndTeamData,
                codyRule,
                userInfoData,
            );

            if (!result) {
                throw new NotFoundException(
                    'Failed to create or update cody rule',
                );
            }

            if (result.uuid && codyRule.repositoryId && codyRule.rule) {
                this.logger.log({
                    message:
                        'Rule created/updated, triggering reference detection',
                    context: CreateOrUpdateCodyRulesUseCase.name,
                    metadata: {
                        ruleId: result.uuid,
                        ruleTitle: codyRule.title,
                        repositoryId: codyRule.repositoryId,
                        hasRuleText: !!codyRule.rule,
                        ruleTextLength: codyRule.rule.length,
                        organizationAndTeamData,
                    },
                });

                this.detectAndSaveReferencesAsync(
                    result.uuid,
                    codyRule.rule,
                    codyRule.repositoryId,
                    organizationAndTeamData,
                ).catch((error) => {
                    this.logger.error({
                        message:
                            'Background reference detection failed completely',
                        context: CreateOrUpdateCodyRulesUseCase.name,
                        error: this.normalizeError(error),
                        metadata: {
                            ruleId: result.uuid,
                            ruleTitle: codyRule.title,
                            organizationAndTeamData,
                        },
                    });
                });

                // T0 (#1449): compile a deterministic detector for mechanical
                // rules so review checks them in pure code. Fire-and-forget,
                // gated — a rule only gets a detector if it passes the compile
                // gate; otherwise it stays semantic. Never blocks the save.
                this.detectorCompiler
                    .compileAndSave(organizationAndTeamData, result.uuid, {
                        ...codyRule,
                        uuid: result.uuid,
                        // Carry the persisted detector (the DTO has none) so
                        // compileAndSave can clear a stale one when an edited
                        // rule stops being mechanical.
                        detector: (result as ICodyRule).detector,
                    })
                    .catch((error) => {
                        this.logger.error({
                            message: 'Background detector compile failed',
                            context: CreateOrUpdateCodyRulesUseCase.name,
                            error: this.normalizeError(error),
                            metadata: { ruleId: result.uuid },
                        });
                    });
            } else {
                this.logger.warn({
                    message:
                        'Reference detection skipped - missing required fields',
                    context: CreateOrUpdateCodyRulesUseCase.name,
                    metadata: {
                        ruleId: result.uuid,
                        hasRepositoryId: !!codyRule.repositoryId,
                        hasRuleText: !!codyRule.rule,
                        repositoryId: codyRule.repositoryId,
                        organizationAndTeamData,
                    },
                });
            }

            return result;
        } catch (error) {
            this.logger.error({
                message: 'Could not create or update Cody rules',
                context: CreateOrUpdateCodyRulesUseCase.name,
                serviceName: 'CreateOrUpdateCodyRulesUseCase',
                error: this.normalizeError(error),
                metadata: {
                    codyRule,
                    organizationAndTeamData: {
                        organizationId,
                    },
                },
            });
            throw error;
        }
    }

    /**
     * Which repo ids the mutation must be authorized against.
     *
     * Normally the rule's own repositoryId. Exception: an inheritance
     * toggle (excluding/including a child scope from an inherited rule)
     * mutates the PARENT rule document, but its effect is scoped to the
     * toggled child — demanding write access on the parent would mean a
     * repo admin cannot opt their own repo out of an inherited global
     * rule ("Error disabling inheritance" 403). When the ONLY change vs
     * the stored rule is inheritance.exclude/include, authorize against
     * the toggled ids instead.
     */
    private async resolveAuthorizationRepoIds(
        codyRule: CreateCodyRuleDto,
    ): Promise<string[] | undefined> {
        const ruleScope = codyRule.repositoryId
            ? [codyRule.repositoryId]
            : undefined;

        if (!codyRule.uuid) {
            return ruleScope;
        }

        const existing = await this.codyRulesService.findById(codyRule.uuid);
        if (!existing) {
            return ruleScope;
        }

        const toggledIds = this.getInheritanceOnlyToggledIds(
            existing,
            codyRule,
        );

        return toggledIds ?? ruleScope;
    }

    /**
     * Returns the ids added/removed in inheritance.exclude/include when
     * those lists are the ONLY difference vs the stored rule, or null
     * when anything else changed (callers then authorize against the
     * rule's own scope, as before).
     *
     * The service update is a merge (`{...existingRule, ...codyRule}`),
     * so every key PRESENT in the payload can overwrite the stored value
     * — compare them all, not a fixed whitelist. `inheritable` is
     * rule-wide (affects every repo), so flipping it is NOT a per-repo
     * toggle.
     */
    private getInheritanceOnlyToggledIds(
        existing: Partial<ICodyRule>,
        incoming: CreateCodyRuleDto,
    ): string[] | null {
        // Args of the request that aren't rule content, plus the lists we
        // diff explicitly below.
        const ignoredKeys = new Set([
            'uuid',
            'inheritance',
            'teamId',
            'createdAt',
            'updatedAt',
        ]);

        const normalized = (value: unknown) =>
            JSON.stringify(value ?? null);

        for (const key of Object.keys(incoming)) {
            if (ignoredKeys.has(key)) {
                continue;
            }
            if (
                normalized((incoming as any)[key]) !==
                normalized((existing as any)[key])
            ) {
                return null;
            }
        }

        const existingInheritance = existing.inheritance ?? {
            inheritable: true,
            exclude: [],
            include: [],
        };
        const incomingInheritance = incoming.inheritance ?? {
            inheritable: true,
            exclude: [],
            include: [],
        };

        if (
            (existingInheritance.inheritable ?? true) !==
            (incomingInheritance.inheritable ?? true)
        ) {
            return null;
        }

        const symmetricDiff = (a: string[] = [], b: string[] = []) => {
            const setA = new Set(a);
            const setB = new Set(b);
            return [
                ...a.filter((id) => !setB.has(id)),
                ...b.filter((id) => !setA.has(id)),
            ];
        };

        const toggledIds = [
            ...new Set([
                ...symmetricDiff(
                    existingInheritance.exclude,
                    incomingInheritance.exclude,
                ),
                ...symmetricDiff(
                    existingInheritance.include,
                    incomingInheritance.include,
                ),
            ]),
        ];

        return toggledIds.length > 0 ? toggledIds : null;
    }

    private async createCentralizedMutationIfEnabled(
        organizationAndTeamData: OrganizationAndTeamData,
        codyRule: CreateCodyRuleDto,
        userInfo: { userId: string; userEmail: string },
    ): Promise<CentralizedPrMetadata | null> {
        const existingRule =
            codyRule.uuid &&
            (await this.codyRulesService.findById(codyRule.uuid));

        if (codyRule.uuid && !existingRule) {
            throw new NotFoundException('Rule not found');
        }

        const effectiveRule = {
            ...existingRule,
            ...codyRule,
            // The incoming DTO carries `centralizedConfig` as an own (null)
            // property even when the caller didn't send it, so a plain spread
            // would clobber the rule's real path. Keep the existing path unless
            // the payload explicitly provides one.
            centralizedConfig:
                codyRule.centralizedConfig ??
                (existingRule
                    ? (existingRule as Partial<ICodyRule>).centralizedConfig
                    : undefined),
        };

        if (!effectiveRule.title || !effectiveRule.repositoryId) {
            return null;
        }

        const resolvedOrgAndTeamData = await this.resolveTeamContextIfMissing(
            organizationAndTeamData,
            effectiveRule.repositoryId,
        );

        const ruleType =
            (effectiveRule.type as CodyRulesType) || CodyRulesType.STANDARD;

        const groupFolderName =
            await this.centralizedConfigPrService.resolveDirectoryGroupFolderName(
                resolvedOrgAndTeamData,
                effectiveRule.repositoryId,
                effectiveRule.directoryId,
            );

        if (
            !effectiveRule.centralizedConfig?.path &&
            effectiveRule.title &&
            effectiveRule.repositoryId
        ) {
            const repositoryFolder =
                await this.centralizedConfigPrService.resolveRepositoryFolderName(
                    resolvedOrgAndTeamData,
                    effectiveRule.repositoryId,
                );

            const rulesDirectory =
                ruleType === CodyRulesType.MEMORY ? 'memories' : 'review';

            const fileName = this.centralizedConfigPrService.buildRuleFileName(
                effectiveRule.title,
                effectiveRule.uuid,
            );

            const centralizedPath = groupFolderName
                ? this.centralizedConfigPrService.buildDirectoryGroupRulesPath(
                      repositoryFolder,
                      groupFolderName,
                      rulesDirectory,
                      fileName,
                  )
                : this.centralizedConfigPrService.buildCentralizedPath({
                      repositoryFolder,
                      relativePath: `.cody-rules/${rulesDirectory}/${fileName}`,
                  });

            effectiveRule.centralizedConfig = {
                path: centralizedPath,
                status: CodyRuleCentralizedStatus.SYNCED,
            };
        }

        const pr =
            await this.centralizedConfigPrService.createMutationPullRequestIfEnabled(
                buildCodyRuleCentralizedMutationRequest({
                    centralizedConfigPrService: this.centralizedConfigPrService,
                    organizationAndTeamData: resolvedOrgAndTeamData,
                    repositoryId: effectiveRule.repositoryId,
                    groupFolderName: groupFolderName ?? undefined,
                    ruleContent: effectiveRule,
                    ruleType,
                    operation: codyRule.uuid ? 'update' : 'create',
                }),
            );

        if (pr.mode !== 'centralized-pr') {
            return null;
        }

        await this.persistRuleWithCentralizedPendingStatus(
            resolvedOrgAndTeamData,
            effectiveRule,
            ruleType,
            codyRule.uuid ? 'update' : 'create',
            userInfo,
            existingRule || undefined,
        );

        return pr;
    }

    private async persistRuleWithCentralizedPendingStatus(
        organizationAndTeamData: OrganizationAndTeamData,
        effectiveRule: Partial<ICodyRule>,
        ruleType: CodyRulesType,
        operation: 'create' | 'update',
        userInfo: { userId: string; userEmail: string },
        existingRule?: Partial<ICodyRule> | null,
    ): Promise<void> {
        if (!effectiveRule.title || !effectiveRule.repositoryId) {
            return;
        }

        try {
            const repositoryFolder =
                await this.centralizedConfigPrService.resolveRepositoryFolderName(
                    organizationAndTeamData,
                    effectiveRule.repositoryId,
                );

            const groupFolderName =
                await this.centralizedConfigPrService.resolveDirectoryGroupFolderName(
                    organizationAndTeamData,
                    effectiveRule.repositoryId,
                    effectiveRule.directoryId,
                );

            const centralizedPath = buildCodyRuleCentralizedFilePath({
                centralizedConfigPrService: this.centralizedConfigPrService,
                repositoryFolder,
                rulesDirectory:
                    ruleType === CodyRulesType.MEMORY ? 'memories' : 'review',
                ruleContent:
                    operation === 'update' && existingRule
                        ? existingRule
                        : effectiveRule,
                groupFolderName: groupFolderName ?? undefined,
            });

            if (operation === 'create') {
                await this.codyRulesService.createOrUpdate(
                    organizationAndTeamData,
                    {
                        ...(effectiveRule as CreateCodyRuleDto),
                        type: ruleType,
                        repositoryId: effectiveRule.repositoryId,
                        status: effectiveRule.status || CodyRulesStatus.ACTIVE,
                        centralizedConfig: {
                            path: centralizedPath,
                            status: CodyRuleCentralizedStatus.PENDING_ADD,
                        },
                    },
                    userInfo,
                );
                return;
            }

            if (!existingRule?.uuid) {
                return;
            }

            await this.codyRulesService.createOrUpdate(
                organizationAndTeamData,
                {
                    ...(existingRule as CreateCodyRuleDto),
                    uuid: existingRule.uuid,
                    type: ruleType,
                    repositoryId: existingRule.repositoryId,
                    status: existingRule.status || CodyRulesStatus.ACTIVE,
                    centralizedConfig: {
                        path: centralizedPath,
                        status: CodyRuleCentralizedStatus.PENDING_EDIT,
                    },
                },
                userInfo,
            );
        } catch (error) {
            this.logger.warn({
                message:
                    'Centralized PR was created, but failed to persist centralized pending snapshot',
                context: CreateOrUpdateCodyRulesUseCase.name,
                error: this.normalizeError(error),
                metadata: {
                    organizationAndTeamData,
                    ruleId: effectiveRule.uuid,
                    repositoryId: effectiveRule.repositoryId,
                },
            });
        }
    }

    private async resolveTeamContextIfMissing(
        organizationAndTeamData: OrganizationAndTeamData,
        repositoryId?: string,
    ): Promise<OrganizationAndTeamData> {
        if (
            organizationAndTeamData.teamId ||
            !repositoryId ||
            repositoryId === 'global'
        ) {
            return organizationAndTeamData;
        }

        try {
            const resolvedTeamId =
                await this.contextResolutionService.getTeamIdByOrganizationAndRepository(
                    organizationAndTeamData.organizationId,
                    repositoryId,
                );

            if (!resolvedTeamId) {
                return organizationAndTeamData;
            }

            return {
                ...organizationAndTeamData,
                teamId: resolvedTeamId,
            };
        } catch (error) {
            this.logger.warn({
                message:
                    'Failed to resolve team context for centralized cody rule mutation',
                context: CreateOrUpdateCodyRulesUseCase.name,
                error: this.normalizeError(error),
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    repositoryId,
                },
            });

            return organizationAndTeamData;
        }
    }

    private async isCentralizedEnabledForRuleMutation(
        organizationAndTeamData: OrganizationAndTeamData,
        repositoryId?: string,
    ): Promise<boolean> {
        const resolvedOrgAndTeamData = await this.resolveTeamContextIfMissing(
            organizationAndTeamData,
            repositoryId,
        );

        const centralizedRepository =
            await this.centralizedConfigPrService.getCentralizedRepositoryIfEnabled(
                resolvedOrgAndTeamData,
            );

        return Boolean(centralizedRepository);
    }

    private async detectAndSaveReferencesAsync(
        ruleId: string,
        ruleText: string,
        repositoryId: string,
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<void> {
        return new Promise((resolve) => {
            setImmediate(async () => {
                try {
                    let resolvedTeamId: string | undefined;
                    if (
                        repositoryId !== 'global' &&
                        !organizationAndTeamData.teamId
                    ) {
                        try {
                            resolvedTeamId =
                                await this.contextResolutionService.getTeamIdByOrganizationAndRepository(
                                    organizationAndTeamData.organizationId,
                                    repositoryId,
                                );
                        } catch (error) {
                            this.logger.warn({
                                message:
                                    'Failed to resolve team for repository, detection may miss cross-repo context',
                                context: CreateOrUpdateCodyRulesUseCase.name,
                                error: this.normalizeError(error),
                                metadata: {
                                    repositoryId,
                                    organizationAndTeamData,
                                },
                            });
                        }
                    }

                    let repositoryName: string;
                    try {
                        if (repositoryId === 'global') {
                            repositoryName = 'global';
                        } else {
                            repositoryName =
                                await this.contextResolutionService.getRepositoryNameByOrganizationAndRepository(
                                    organizationAndTeamData.organizationId,
                                    repositoryId,
                                );
                        }
                    } catch (error) {
                        this.logger.warn({
                            message:
                                'Failed to resolve repository name, using ID as fallback',
                            context: CreateOrUpdateCodyRulesUseCase.name,
                            error: this.normalizeError(error),
                            metadata: {
                                repositoryId,
                                organizationAndTeamData,
                            },
                        });
                        repositoryName = repositoryId;
                    }

                    const detectionOrgData: OrganizationAndTeamData =
                        resolvedTeamId
                            ? {
                                  ...organizationAndTeamData,
                                  teamId: resolvedTeamId,
                              }
                            : organizationAndTeamData;

                    const detectionFields: ContextDetectionField[] = [
                        {
                            fieldId: '',
                            path: ['codyRule', ruleId],
                            sourceType: PromptSourceType.CODY_RULE,
                            text: ruleText,
                            metadata: {
                                sourceSnippet: ruleText,
                            },
                            consumerKind: 'prompt',
                            consumerName: ruleId,
                            conversationIdOverride: ruleId,
                            requestDomain: 'code',
                            taskIntent: 'Process codyRule references',
                        },
                    ];

                    const [byokConfig, subscriptionStatus] = await Promise.all([
                        this.permissionValidationService.getBYOKConfig(
                            detectionOrgData,
                        ),
                        this.permissionValidationService.getSubscriptionStatus(
                            detectionOrgData,
                        ),
                    ]);

                    const contextReferenceId =
                        await this.contextReferenceDetectionService.detectAndSaveReferences(
                            {
                                entityType: 'codyRule',
                                entityId: ruleId,
                                fields: detectionFields,
                                repositoryId,
                                repositoryName,
                                organizationAndTeamData: detectionOrgData,
                                byokConfig: byokConfig ?? undefined,
                                subscriptionStatus,
                            },
                        );

                    await this.codyRulesService.updateRuleReferences(
                        organizationAndTeamData.organizationId,
                        ruleId,
                        {
                            contextReferenceId,
                        },
                    );

                    this.logger.log({
                        message:
                            'CodyRule successfully processed with Context OS',
                        context: CreateOrUpdateCodyRulesUseCase.name,
                        metadata: {
                            ruleId,
                            contextReferenceId,
                            repositoryId,
                        },
                    });
                } catch (error) {
                    this.logger.error({
                        message: 'Failed to process codyRule with Context OS',
                        context: CreateOrUpdateCodyRulesUseCase.name,
                        error: this.normalizeError(error),
                        metadata: {
                            ruleId,
                            repositoryId,
                            organizationAndTeamData,
                        },
                    });
                }

                resolve();
            });
        });
    }

    private normalizeError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }

    private isInternalSyncActor(userInfo: {
        userId: string;
        userEmail: string;
    }): boolean {
        return (
            userInfo.userId === 'cody' && userInfo.userEmail === 'cody@kodus.io'
        );
    }
}
