import { createLogger } from '@libs/core/log/logger';
import { Injectable, Inject } from '@nestjs/common';

import {
    CentralizedConfigPrService,
    CentralizedPrMetadata,
} from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';
import {
    CODY_RULES_SERVICE_TOKEN,
    ICodyRulesService,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import { buildCodyRuleCentralizedMutationRequest } from '@libs/centralized-config/utils/cody-rules-centralized-pr.builder';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import {
    CodyRuleCentralizedStatus,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

@Injectable()
export class DeleteRuleInOrganizationByIdCodyRulesUseCase {
    private readonly logger = createLogger(
        DeleteRuleInOrganizationByIdCodyRulesUseCase.name,
    );
    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,

        private readonly centralizedConfigPrService: CentralizedConfigPrService,

        private readonly authorizationService: AuthorizationService,
    ) {}

    async execute(
        ruleId: string,
        actor?: {
            source?: 'cli' | 'web' | 'sync';
            organizationId?: string;
            teamId?: string;
            userId?: string;
            userEmail?: string;
        },
        // The authenticated user, forwarded by the controller. Use-cases must
        // not inject REQUEST (it makes them request-scoped, which bubbles up
        // into singleton callers like event listeners and sync services).
        requestUser?: UserRequest['user'],
    ): Promise<boolean | CentralizedPrMetadata> {
        try {
            const ru: any = requestUser;
            const organizationId =
                actor?.organizationId || ru?.organization?.uuid;
            const teamId = actor?.teamId || ru?.team?.uuid || ru?.teamId;

            const existingRule = await this.codyRulesService.findById(ruleId);

            // The controller guard is type-level only — it cannot see which
            // repository the rule belongs to. Enforce repo scope here (same
            // contract as ChangeStatusCodyRulesUseCase): a repo-scoped role
            // may only delete rules of its assigned repositories; rules
            // without a repositoryId (org-wide/global) stay owner-only.
            // Machine flows (sync, or no request context) are exempt.
            if (existingRule && actor?.source !== 'sync' && requestUser) {
                await this.authorizationService.ensure({
                    user: requestUser,
                    action: Action.Delete,
                    resource: ResourceType.CodyRules,
                    repoIds: existingRule.repositoryId
                        ? [existingRule.repositoryId]
                        : undefined,
                });
            }

            if (existingRule && actor?.source !== 'sync') {
                const groupFolderName =
                    await this.centralizedConfigPrService.resolveDirectoryGroupFolderName(
                        { organizationId, teamId },
                        existingRule.repositoryId,
                        existingRule.directoryId,
                    );

                const pr =
                    await this.centralizedConfigPrService.createMutationPullRequestIfEnabled(
                        buildCodyRuleCentralizedMutationRequest({
                            centralizedConfigPrService:
                                this.centralizedConfigPrService,
                            organizationAndTeamData: {
                                organizationId,
                                teamId,
                            },
                            repositoryId: existingRule.repositoryId,
                            groupFolderName: groupFolderName ?? undefined,
                            ruleContent: existingRule,
                            ruleType:
                                (existingRule.type as CodyRulesType) ||
                                CodyRulesType.STANDARD,
                            operation: 'delete',
                        }),
                    );

                if (pr.mode === 'centralized-pr') {
                    const repositoryFolder =
                        await this.centralizedConfigPrService.resolveRepositoryFolderName(
                            {
                                organizationId,
                                teamId,
                            },
                            existingRule.repositoryId,
                        );

                    const rulesDirectory =
                        ((existingRule.type as CodyRulesType) ||
                            CodyRulesType.STANDARD) === CodyRulesType.MEMORY
                            ? 'memories'
                            : 'review';

                    const fileName =
                        this.centralizedConfigPrService.buildRuleFileName(
                            existingRule.title,
                            existingRule.uuid,
                        );

                    const centralizedPath =
                        existingRule.centralizedConfig?.path ||
                        (groupFolderName
                            ? this.centralizedConfigPrService.buildDirectoryGroupRulesPath(
                                  repositoryFolder,
                                  groupFolderName,
                                  rulesDirectory,
                                  fileName,
                              )
                            : this.centralizedConfigPrService.buildCentralizedPath(
                                  {
                                      repositoryFolder,
                                      relativePath: `.cody-rules/${rulesDirectory}/${fileName}`,
                                  },
                              ));

                    await this.codyRulesService.createOrUpdate(
                        {
                            organizationId,
                            teamId,
                        },
                        {
                            ...existingRule,
                            uuid: existingRule.uuid,
                            type:
                                (existingRule.type as CodyRulesType) ||
                                CodyRulesType.STANDARD,
                            status:
                                existingRule.status || CodyRulesStatus.ACTIVE,
                            centralizedConfig: {
                                path: centralizedPath,
                                status: CodyRuleCentralizedStatus.PENDING_DELETE,
                            },
                        } as any,
                        {
                            userId: actor?.userId || requestUser?.uuid,
                            userEmail: actor?.userEmail || requestUser?.email,
                        },
                    );

                    return pr;
                }
            }

            return await this.codyRulesService.deleteRuleWithLogging(
                {
                    organizationId,
                },
                ruleId,
                {
                    userId: actor?.userId || ru?.uuid,
                    userEmail: actor?.userEmail || ru?.email,
                },
            );
        } catch (error) {
            this.logger.error({
                message: 'Error deleting Cody Rule in organization by ID',
                context: DeleteRuleInOrganizationByIdCodyRulesUseCase.name,
                error: error,
                metadata: {
                    organizationId:
                        actor?.organizationId ||
                        (requestUser as any)?.organization?.uuid,
                    ruleId,
                },
            });
            throw error;
        }
    }
}
