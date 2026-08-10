import {
    forwardRef,
    Inject,
    Injectable,
    NotFoundException,
    Optional,
} from '@nestjs/common';
import { CodyRuleSummaryService } from '@libs/codyRules/infrastructure/adapters/services/cody-rule-summary.service';
import { v4 } from 'uuid';
import bucketsData from './data/buckets.json';
import libraryCodyRules from './data/library-cody-rules.json';

import { createLogger } from '@libs/core/log/logger';
import { CentralizedConfigPrService } from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';
import { ModuleRef } from '@nestjs/core';
import {
    buildCodyRuleCentralizedFilePath,
    buildCodyRuleCentralizedMutationRequest,
} from '@libs/centralized-config/utils/cody-rules-centralized-pr.builder';
import { PromptRunnerService } from '@codus/codus-common/llm';
import {
    CODE_BASE_CONFIG_SERVICE_TOKEN,
    ICodeBaseConfigService,
} from '@libs/code-review/domain/contracts/CodeBaseConfigService.contract';
import {
    codyMemoryResolutionSchema,
    prompt_codyMemoryResolution_system,
    prompt_codyMemoryResolution_user,
} from '@libs/common/utils/langchainCommon/prompts/codyMemoryResolution';
import { codyRulesRecommendationSchema } from '@libs/common/utils/langchainCommon/prompts/codyRulesRecommendation';
import { ProgrammingLanguage } from '@libs/core/domain/enums';
import {
    ActionType,
    UserInfo,
} from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';
import {
    BucketInfo,
    CodyRuleFilters,
    LibraryCodyRule,
} from '@libs/core/infrastructure/config/types/general/codyRules.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { runStructuredReviewCall } from '@libs/llm/structured-review-call';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogEvents } from '@libs/ee/codeReviewSettingsLog/events/audit-log.events';
import {
    CreateCodyRuleDto,
    CodyRuleSeverity,
} from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import { PermissionValidationService } from '@libs/ee/shared/services/permissionValidation.service';
import {
    ICodyRulesRepository,
    CODY_RULES_REPOSITORY_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.repository.contract';
import {
    CreateOrUpdateMemoryResult,
    ICodyRulesService,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    IRuleLikeService,
    RULE_LIKE_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/ruleLike.service.contract';
import { CodyRulesEntity } from '@libs/codyRules/domain/entities/codyRules.entity';
import {
    FindMemoriesFilters,
    FindMemoriesResult,
    ICodyRule,
    ICodyRuleDetector,
    ICodyRuleMemory,
    ICodyRules,
    CodyRuleCentralizedStatus,
    CodyRuleRequestType,
    CodyRulesScope,
    CodyRulesOrigin,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { MCPManagerService } from '@libs/mcp-server/services/mcp-manager.service';
import {
    IPullRequestsRepository,
    PULL_REQUESTS_REPOSITORY_TOKEN,
} from '@libs/platformData/domain/pullRequests/contracts/pullRequests.repository';
import { CodyRulesValidationService } from './cody-rules-validation.service';
import { buildCodyRuleAppLink } from '../utils/build-rule-link';
import { isGeneratedCodyRuleOrigin } from '@libs/common/utils/cody-rules/resolve-origin';
import { requiresKnowledgeApproval } from '@libs/common/utils/cody-rules/knowledge-approval';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { ParametersKey } from '@libs/core/domain/enums';
import {
    CodeReviewParameter,
    ICodeRepository,
    RepositoryCodeReviewConfig,
} from '@libs/core/infrastructure/config/types/general/codeReviewConfig.type';
import { IntegrationConfigKey } from '@libs/core/domain/enums/Integration-config-key.enum';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/integrationConfigs/contracts/integration-config.service.contracts';

@Injectable()
export class CodyRulesService implements ICodyRulesService {
    private readonly logger = createLogger(CodyRulesService.name);

    constructor(
        @Inject(CODY_RULES_REPOSITORY_TOKEN)
        private readonly codyRulesRepository: ICodyRulesRepository,

        private readonly eventEmitter: EventEmitter2,

        @Inject(RULE_LIKE_SERVICE_TOKEN)
        private readonly ruleLikeService: IRuleLikeService,

        @Inject(PULL_REQUESTS_REPOSITORY_TOKEN)
        private readonly pullRequestsRepository: IPullRequestsRepository,

        private readonly codyRulesValidationService: CodyRulesValidationService,

        private readonly mcpManagerService: MCPManagerService,

        private readonly promptRunnerService: PromptRunnerService,

        private readonly observabilityService: ObservabilityService,

        private readonly permissionValidationService: PermissionValidationService,

        // ModuleRef em vez de injetar CentralizedConfigPrService direto.
        // CodyRulesService ↔ CentralizedConfigPrService formam um ciclo
        // profundo, e CCP é request-scoped (transitivamente, via
        // codeManagementService). forwardRef nessa combinação produzia
        // um proxy vazio em runtime. moduleRef.resolve() resolve o
        // provider lazy, no contexto correto, sem precisar refatorar o
        // ciclo.
        private readonly moduleRef: ModuleRef,

        @Inject(forwardRef(() => CODE_BASE_CONFIG_SERVICE_TOKEN))
        private readonly codeBaseConfigService: ICodeBaseConfigService,

        // Optional so existing manual instantiations/specs keep working; when
        // absent the summary hook is simply skipped (lazy backfill in the
        // review path covers it).
        @Optional()
        private readonly codyRuleSummaryService?: CodyRuleSummaryService,
    ) {}

    /**
     * Fire-and-forget summary generation for a just-written LONG rule.
     * Detached from the request (setImmediate + captured plain values — no
     * request-scoped references, see the finish-onboarding 504 postmortem) so
     * writes never wait on an LLM. Short rules never reach generation;
     * ensureAtoms also no-ops when a fresh decomposition already exists.
     */
    private scheduleSummaryGeneration(
        organizationAndTeamData: OrganizationAndTeamData,
        rule: Partial<ICodyRule>,
    ): void {
        if (!this.codyRuleSummaryService?.isLong(rule.rule)) {
            return;
        }
        const summaryService = this.codyRuleSummaryService;
        const orgData: OrganizationAndTeamData = {
            organizationId: organizationAndTeamData.organizationId,
            teamId: organizationAndTeamData.teamId,
        };
        const snapshot: Partial<ICodyRule> = { ...rule };
        setImmediate(() => {
            summaryService.ensureAtoms([snapshot], orgData).catch((error) =>
                this.logger.warn({
                    message:
                        '[cody-rule-summary] background generation failed after rule write',
                    context: CodyRulesService.name,
                    metadata: {
                        organizationId: orgData.organizationId,
                        ruleUuid: rule.uuid,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    },
                }),
            );
        });
    }

    // CCP é request-scoped (depende transitivamente de algo
    // request-scoped, provavelmente codeManagementService com token
    // multi-tenant). ModuleRef.get() não funciona com scoped providers
    // — precisa ser ModuleRef.resolve(), que é async e cria uma
    // instância no contexto atual de injeção.
    private async resolveCentralizedConfigPrService(): Promise<CentralizedConfigPrService> {
        return this.moduleRef.resolve(CentralizedConfigPrService, undefined, {
            strict: false,
        });
    }

    countRules(
        organizationId: string,
        status?: CodyRulesStatus,
    ): Promise<number> {
        throw new Error('Method not implemented.');
    }

    getNativeCollection() {
        throw new Error('Method not implemented.');
    }

    async create(
        codyRules: Omit<ICodyRules, 'uuid'>,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.create(codyRules);
    }

    async findById(uuid: string): Promise<ICodyRule | null> {
        return this.codyRulesRepository.findById(uuid);
    }

    async findOne(
        filter?: Partial<ICodyRules>,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.findOne(filter);
    }

    async find(filter?: Partial<ICodyRules>): Promise<CodyRulesEntity[]> {
        const entities = await this.codyRulesRepository.find(filter);

        return entities?.map((entity) => {
            const normalized = entity.toObject();
            normalized.rules = normalized.rules.map((rule) => ({
                ...rule,
                severity: rule.severity?.toLowerCase(),
            }));
            return CodyRulesEntity.create(normalized);
        });
    }

    async findByOrganizationId(
        organizationId: string,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.findByOrganizationId(organizationId);
    }

    async findOrganizationIdsWithRules(): Promise<string[]> {
        return this.codyRulesRepository.findOrganizationIdsWithRules();
    }

    /**
     * Obtém informações sobre limites de Cody Rules para uma organização
     * Usado pelo frontend para controlar UI (desabilitar botões, mostrar avisos, etc)
     */
    async getRulesLimitStatus(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<{
        total: number;
    }> {
        try {
            // Count server-side via aggregation instead of loading the
            // entire rules array and filtering in JS. Orgs with 100s–
            // 1000s of rules saw the old path transfer 100KB+ of
            // embedded docs per request just to compute a single
            // number.
            const total = await this.codyRulesRepository.countRules(
                organizationAndTeamData.organizationId,
                CodyRulesStatus.ACTIVE,
            );

            return { total };
        } catch (error) {
            this.logger.error({
                message: 'Error getting rules limit status',
                error: error,
                context: CodyRulesService.name,
                metadata: { organizationAndTeamData },
            });
            throw error;
        }
    }

    /**
     * Per-(repo, directory) rule counts for an organization, computed in a
     * single aggregation. Counts ACTIVE + PAUSED — the pool the user sees
     * in the list (mirrors `useCodyRulesCount` on the web). Drives the per
     * repository/directory count badges without fetching each repo's full
     * rules array (and running enrichment) once per card.
     */
    async countRulesByRepository(organizationId: string): Promise<
        Array<{
            repositoryId: string;
            directoryId: string | null;
            count: number;
        }>
    > {
        return this.codyRulesRepository.countRulesByRepository(organizationId, [
            CodyRulesStatus.ACTIVE,
            CodyRulesStatus.PAUSED,
        ]);
    }

    /**
     * Busca rules específicas por organização, repositório e diretório
     * Versão simplificada que filtra in-memory
     */
    async findRulesByDirectory(
        organizationId: string,
        repositoryId: string,
        directoryId: string,
        type?: CodyRulesType,
    ): Promise<Partial<ICodyRule>[]> {
        const entity = await this.findByOrganizationId(organizationId);

        if (!entity?.toObject()?.rules) {
            return [];
        }

        return entity
            .toObject()
            .rules.filter(
                (rule) =>
                    (type ? rule.type === type : true) &&
                    rule.repositoryId === repositoryId &&
                    rule.directoryId === directoryId &&
                    rule.status === CodyRulesStatus.ACTIVE,
            );
    }

    async update(
        uuid: string,
        updateData: Partial<ICodyRules>,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.update(uuid, updateData);
    }

    async delete(uuid: string): Promise<boolean> {
        return this.codyRulesRepository.delete(uuid);
    }

    async addRule(
        uuid: string,
        newRule: Partial<ICodyRule>,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.addRule(uuid, newRule);
    }

    async updateRule(
        uuid: string,
        ruleId: string,
        updateData: Partial<ICodyRule>,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.updateRule(uuid, ruleId, updateData);
    }

    async createOrUpdate(
        organizationAndTeamData: OrganizationAndTeamData,
        codyRule: CreateCodyRuleDto,
        userInfo: UserInfo,
    ): Promise<Partial<ICodyRule> | ICodyRule | null> {
        const existing = await this.findByOrganizationId(
            organizationAndTeamData.organizationId,
        );

        // The new rule only consumes plan quota if it lands ACTIVE — quota
        // counts ACTIVE only (see the gate in the existing-doc branch and
        // getRulesLimitStatus). A rule created paused/pending doesn't count.
        const newRuleCountsTowardQuota =
            (codyRule?.status ?? CodyRulesStatus.ACTIVE) ===
            CodyRulesStatus.ACTIVE;

        // If no rules exist for the organization
        if (!existing) {
            if (codyRule.uuid) {
                throw new NotFoundException('Rule not found');
            }

            const { status: resolvedStatus, lockedByPlan } =
                await this.resolveStatusWithinPlanLimit(
                    organizationAndTeamData,
                    codyRule?.status ?? CodyRulesStatus.ACTIVE,
                    newRuleCountsTowardQuota ? 1 : 0,
                );

            const newRule: ICodyRule = {
                uuid: v4(),
                type: codyRule?.type ?? CodyRulesType.STANDARD,
                title: codyRule?.title,
                rule: codyRule?.rule,
                path: codyRule?.path,
                severity: codyRule?.severity?.toLowerCase(),
                status: resolvedStatus,
                lockedByPlan,
                sourcePath: codyRule?.sourcePath,
                centralizedConfig: codyRule?.centralizedConfig,
                sourceAnchor: codyRule?.sourceAnchor,
                repositoryId: codyRule?.repositoryId,
                sourceRepositoryId: codyRule?.sourceRepositoryId,
                lastContentHash: codyRule?.lastContentHash,
                directoryId: codyRule?.directoryId,
                examples: codyRule?.examples,
                origin: codyRule?.origin ?? CodyRulesOrigin.MANUAL,
                scope: codyRule?.scope ?? CodyRulesScope.FILE,
                inheritance: {
                    inheritable: codyRule?.inheritance?.inheritable ?? true,
                    exclude: codyRule?.inheritance?.exclude ?? [],
                    include: codyRule?.inheritance?.include ?? [],
                },
                requestType: codyRule?.requestType,
                targetRuleUuid: codyRule?.targetRuleUuid,
                resolvedAt: codyRule?.resolvedAt,
                resolvedBy: codyRule?.resolvedBy,
                pinnedSync: codyRule?.pinnedSync,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const newCodyRules = await this.create({
                organizationId: organizationAndTeamData.organizationId,
                rules: [newRule],
            });

            if (!newCodyRules) {
                throw new Error(
                    'Could not create new Cody rules for organization',
                );
            }

            this.eventEmitter.emit(AuditLogEvents.CODY_RULES, {
                organizationAndTeamData,
                userInfo,
                actionType:
                    newRule.origin === CodyRulesOrigin.LIBRARY
                        ? ActionType.CLONE
                        : ActionType.CREATE,
                repository: { id: newRule.repositoryId },
                oldRule: undefined,
                newRule: newRule,
                ruleTitle: newRule.title,
            });

            await this.ensureRepositoryCodeReviewConfig(
                organizationAndTeamData,
                newRule,
            );

            this.scheduleSummaryGeneration(organizationAndTeamData, newRule);

            return newCodyRules.rules[0];
        }

        // If there is no UUID, it is a new rule
        if (!codyRule.uuid) {
            // Count ACTIVE only, matching the `/limits` endpoint
            // (getRulesLimitStatus → countRules(ACTIVE)). Counting
            // `!== DELETED` also counts PAUSED/PENDING rules the UI never
            // shows against the quota, so the UI says "add away" while this
            // gate rejects. Paused/pending rules aren't enforced and don't
            // consume plan quota. The +1 is conditional: a rule created
            // already paused/pending doesn't add to the active count.
            const activeRulesCount = (existing.rules ?? []).filter(
                (r) => r.status === CodyRulesStatus.ACTIVE,
            ).length;
            const { status: resolvedStatus, lockedByPlan } =
                await this.resolveStatusWithinPlanLimit(
                    organizationAndTeamData,
                    codyRule.status ?? CodyRulesStatus.ACTIVE,
                    activeRulesCount + (newRuleCountsTowardQuota ? 1 : 0),
                );

            const newRule: ICodyRule = {
                uuid: v4(),
                type: codyRule.type,
                title: codyRule.title,
                rule: codyRule.rule,
                path: codyRule.path,
                sourcePath: codyRule.sourcePath,
                centralizedConfig: codyRule.centralizedConfig,
                sourceAnchor: codyRule.sourceAnchor,
                severity: codyRule.severity?.toLowerCase(),
                status: resolvedStatus,
                lockedByPlan,
                repositoryId: codyRule?.repositoryId,
                sourceRepositoryId: codyRule?.sourceRepositoryId,
                lastContentHash: codyRule?.lastContentHash,
                directoryId: codyRule?.directoryId,
                examples: codyRule?.examples,
                origin: codyRule?.origin ?? CodyRulesOrigin.MANUAL,
                scope: codyRule?.scope ?? CodyRulesScope.FILE,
                inheritance: {
                    inheritable: codyRule?.inheritance?.inheritable ?? true,
                    exclude: codyRule?.inheritance?.exclude ?? [],
                    include: codyRule?.inheritance?.include ?? [],
                },
                requestType: codyRule?.requestType,
                targetRuleUuid: codyRule?.targetRuleUuid,
                resolvedAt: codyRule?.resolvedAt,
                resolvedBy: codyRule?.resolvedBy,
                pinnedSync: codyRule?.pinnedSync,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedCodyRules = await this.addRule(existing.uuid, newRule);

            if (!updatedCodyRules) {
                throw new Error('Could not add new rule');
            }

            this.eventEmitter.emit(AuditLogEvents.CODY_RULES, {
                organizationAndTeamData,
                userInfo,
                actionType:
                    newRule.origin === CodyRulesOrigin.LIBRARY
                        ? ActionType.CLONE
                        : ActionType.CREATE,
                repository: { id: newRule.repositoryId },
                directory: { id: newRule.directoryId },
                oldRule: undefined,
                newRule: newRule,
                ruleTitle: newRule.title,
            });

            await this.ensureRepositoryCodeReviewConfig(
                organizationAndTeamData,
                newRule,
            );

            this.scheduleSummaryGeneration(organizationAndTeamData, newRule);

            return updatedCodyRules.rules.find(
                (rule) => rule.uuid === newRule.uuid,
            );
        }

        // If there is a UUID, it is an update
        const existingRule = existing?.rules?.find(
            (rule) => rule.uuid === codyRule.uuid,
        );

        if (!existingRule) {
            throw new NotFoundException('Rule not found');
        }

        // When unpausing (changing from non-ACTIVE to ACTIVE), re-check the
        // free-plan quota so the user can't bypass the 10-rule limit by
        // pausing and creating new rules — if the org is still over quota,
        // the rule stays PAUSED (lockedByPlan) instead of reactivating.
        let statusOverride: Partial<
            Pick<ICodyRule, 'status' | 'lockedByPlan'>
        > = {};

        if (
            codyRule.status === CodyRulesStatus.ACTIVE &&
            existingRule.status !== CodyRulesStatus.ACTIVE
        ) {
            const activeRulesCount = (existing.rules ?? []).filter(
                (r) => r.status === CodyRulesStatus.ACTIVE,
            ).length;
            statusOverride = await this.resolveStatusWithinPlanLimit(
                organizationAndTeamData,
                CodyRulesStatus.ACTIVE,
                activeRulesCount + 1,
            );
        } else if (
            codyRule.status !== undefined &&
            codyRule.status !== CodyRulesStatus.ACTIVE
        ) {
            // Any explicit non-ACTIVE transition (manual pause, reject,
            // delete) is user-initiated, not a plan lock.
            statusOverride = { status: codyRule.status, lockedByPlan: false };
        }

        // Normalize severity on the way in (create/addRule already do this);
        // otherwise an update could persist a mixed-case severity that only
        // looks consistent because find() lower-cases on read.
        const mergedSeverity = (
            codyRule.severity ?? existingRule.severity
        )?.toLowerCase();

        const updatedRule = {
            ...existingRule,
            ...codyRule,
            ...statusOverride,
            ...(mergedSeverity ? { severity: mergedSeverity } : {}),
            updatedAt: new Date(),
        };

        // The spread above carries the OLD summary. If the rule text changed
        // it is stale (would also fail the sourceHash guard at review time):
        // drop it — this also covers a long rule edited down to a short one,
        // which must not keep a summary of its former long text. A long new
        // text gets a fresh summary scheduled below.
        const ruleTextChanged =
            codyRule.rule !== undefined && codyRule.rule !== existingRule.rule;
        // Examples gate the atom detectors (atoms sourceHash covers them), so
        // an examples-only edit invalidates the DECOMPOSITION — but not the
        // summary, whose hash covers the rule text alone and stays valid as
        // the fallback while fresh atoms are regenerated.
        const examplesChanged =
            codyRule.examples !== undefined &&
            JSON.stringify(codyRule.examples) !==
                JSON.stringify(existingRule.examples);
        if (ruleTextChanged) {
            delete (updatedRule as Partial<ICodyRule>).summary;
            delete (updatedRule as Partial<ICodyRule>).atoms;
        } else if (examplesChanged) {
            delete (updatedRule as Partial<ICodyRule>).atoms;
        }

        const updatedCodyRules = await this.updateRule(
            existing.uuid,
            codyRule.uuid,
            updatedRule,
        );

        if (updatedCodyRules && (ruleTextChanged || examplesChanged)) {
            this.scheduleSummaryGeneration(
                organizationAndTeamData,
                updatedRule,
            );
        }

        this.eventEmitter.emit(AuditLogEvents.CODY_RULES, {
            organizationAndTeamData,
            userInfo: userInfo || {
                userId: 'cody-system',
                userEmail: 'cody@kodus.io',
            },
            actionType: ActionType.EDIT,
            repository: { id: updatedRule.repositoryId },
            directory: { id: updatedRule.directoryId },
            oldRule: existingRule,
            newRule: updatedRule,
            ruleTitle: updatedRule.title,
        });

        if (!updatedCodyRules) {
            throw new Error('Could not update rule');
        }

        return updatedCodyRules.rules.find(
            (rule) => rule.uuid === codyRule.uuid,
        );
    }

    private async ensureRepositoryCodeReviewConfig(
        organizationAndTeamData: OrganizationAndTeamData,
        rule: Partial<ICodyRule>,
    ): Promise<void> {
        if (
            rule.origin === CodyRulesOrigin.MANUAL ||
            rule.origin === CodyRulesOrigin.ONBOARDING_REPO_ANALYSIS ||
            !rule.repositoryId ||
            rule.repositoryId === 'global'
        ) {
            return;
        }

        let parametersService: IParametersService;
        let integrationConfigService: IIntegrationConfigService;
        try {
            parametersService = this.moduleRef.get(PARAMETERS_SERVICE_TOKEN, {
                strict: false,
            });
            integrationConfigService = this.moduleRef.get(
                INTEGRATION_CONFIG_SERVICE_TOKEN,
                { strict: false },
            );
        } catch {
            return;
        }

        try {
            const codeReviewConfig = await parametersService.findByKey(
                ParametersKey.CODE_REVIEW_CONFIG,
                organizationAndTeamData,
            );

            let repositoryName = rule.repositoryId;
            try {
                const repos =
                    await integrationConfigService.findIntegrationConfigFormatted<
                        ICodeRepository[]
                    >(
                        IntegrationConfigKey.REPOSITORIES,
                        organizationAndTeamData,
                    );

                const matched = repos?.find((r) => r.id === rule.repositoryId);
                if (matched?.name) {
                    repositoryName = matched.name;
                }
            } catch {
                // fallback: use repositoryId as name
            }

            const newRepo: RepositoryCodeReviewConfig = {
                id: rule.repositoryId,
                name: repositoryName,
                isSelected: true,
                configs: {},
            };

            if (!codeReviewConfig?.configValue) {
                const configValue: CodeReviewParameter = {
                    id: 'global',
                    name: 'Global',
                    isSelected: true,
                    configs: {},
                    repositories: [newRepo],
                };

                await parametersService.createOrUpdateConfig(
                    ParametersKey.CODE_REVIEW_CONFIG,
                    configValue,
                    organizationAndTeamData,
                );

                return;
            }

            const configValue =
                codeReviewConfig.configValue as CodeReviewParameter;
            const repositories = configValue.repositories || [];

            if (repositories.some((r) => r.id === rule.repositoryId)) {
                return;
            }

            const updatedConfigValue: CodeReviewParameter = {
                ...configValue,
                repositories: [...repositories, newRepo],
            };

            await parametersService.createOrUpdateConfig(
                ParametersKey.CODE_REVIEW_CONFIG,
                updatedConfigValue,
                organizationAndTeamData,
            );
        } catch (error) {
            this.logger.error({
                message:
                    'Failed to auto-create repository config for auto-generated rule',
                context: CodyRulesService.name,
                error,
                metadata: {
                    repositoryId: rule.repositoryId,
                    ruleId: rule.uuid,
                    ruleOrigin: rule.origin,
                    organizationAndTeamData,
                },
            });
        }
    }

    async updateRuleReferences(
        organizationId: string,
        ruleId: string,
        references: {
            contextReferenceId?: string;
            // Todos os outros campos de referência foram movidos para Context OS
        },
    ): Promise<ICodyRule | null> {
        this.logger.log({
            message: 'CodyRulesService.updateRuleReferences called',
            context: CodyRulesService.name,
            metadata: {
                organizationId,
                ruleId,
                contextReferenceId: references.contextReferenceId,
                strategy: 'context-os-only', // Todos os campos de referência ficam no Context OS
            },
        });

        const existing = await this.findByOrganizationId(organizationId);

        if (!existing) {
            throw new NotFoundException(
                'Cody rules not found for organization',
            );
        }

        const existingRule = existing.rules?.find(
            (rule) => rule.uuid === ruleId,
        );

        if (!existingRule) {
            throw new NotFoundException('Rule not found');
        }

        const updatedRule = {
            ...existingRule,
            contextReferenceId: references.contextReferenceId,
            // Todos os outros campos de referência foram movidos para Context OS
            updatedAt: new Date(),
        } as ICodyRule;

        const updatedCodyRules = await this.updateRule(
            existing.uuid,
            ruleId,
            updatedRule,
        );

        if (!updatedCodyRules) {
            this.logger.error({
                message: 'Could not update rule references',
                error: new Error('Could not update rule references'),
                context: CodyRulesService.name,
                metadata: {
                    organizationId,
                    ruleId,
                    references,
                },
            });
            throw new Error('Could not update rule references');
        }

        const updatedRuleResult = updatedCodyRules.rules.find(
            (rule) => rule.uuid === ruleId,
        );

        return updatedRuleResult ? (updatedRuleResult as ICodyRule) : null;
    }

    async updateRuleDetector(
        organizationId: string,
        ruleId: string,
        detector: ICodyRuleDetector | null,
    ): Promise<ICodyRule | null> {
        const existing = await this.findByOrganizationId(organizationId);
        if (!existing) {
            throw new NotFoundException(
                'Cody rules not found for organization',
            );
        }

        const existingRule = existing.rules?.find((r) => r.uuid === ruleId);
        if (!existingRule) {
            throw new NotFoundException('Rule not found');
        }

        const updatedRule = {
            ...existingRule,
            // Pass `null` through as-is: updateRule skips only `undefined`, so
            // `detector: null` writes `$set rules.$.detector = null` and clears
            // a stale detector. `?? undefined` here would silently no-op the
            // clear and leave the old regex firing forever.
            detector: detector,
            updatedAt: new Date(),
        } as ICodyRule;

        const updatedCodyRules = await this.updateRule(
            existing.uuid,
            ruleId,
            updatedRule,
        );

        if (!updatedCodyRules) {
            this.logger.error({
                message: 'Could not update rule detector',
                error: new Error('Could not update rule detector'),
                context: CodyRulesService.name,
                metadata: { organizationId, ruleId },
            });
            throw new Error('Could not update rule detector');
        }

        const updated = updatedCodyRules.rules.find((r) => r.uuid === ruleId);
        return updated ? (updated as ICodyRule) : null;
    }

    async updateRuleWithLogging(
        organizationAndTeamData: OrganizationAndTeamData,
        codyRule: CreateCodyRuleDto,
        userInfo?: UserInfo,
    ): Promise<Partial<ICodyRule> | ICodyRule | null> {
        const existing = await this.findByOrganizationId(
            organizationAndTeamData.organizationId,
        );

        if (!existing) {
            throw new NotFoundException('Organization rules not found');
        }

        const existingRule = existing.rules.find(
            (rule) => rule.uuid === codyRule.uuid,
        );

        if (!existingRule) {
            throw new NotFoundException('Rule not found');
        }

        // Normalize severity on the way in (create/addRule already do this);
        // otherwise an update could persist a mixed-case severity that only
        // looks consistent because find() lower-cases on read.
        const mergedSeverity = (
            codyRule.severity ?? existingRule.severity
        )?.toLowerCase();

        const updatedRule = {
            ...existingRule,
            ...codyRule,
            ...(mergedSeverity ? { severity: mergedSeverity } : {}),
            updatedAt: new Date(),
        };

        // Same stale-summary treatment as createOrUpdate: text changed →
        // drop the carried-over summary and schedule a fresh one below.
        const ruleTextChanged =
            codyRule.rule !== undefined && codyRule.rule !== existingRule.rule;
        // Examples gate the atom detectors (atoms sourceHash covers them), so
        // an examples-only edit invalidates the DECOMPOSITION — but not the
        // summary, whose hash covers the rule text alone and stays valid as
        // the fallback while fresh atoms are regenerated.
        const examplesChanged =
            codyRule.examples !== undefined &&
            JSON.stringify(codyRule.examples) !==
                JSON.stringify(existingRule.examples);
        if (ruleTextChanged) {
            delete (updatedRule as Partial<ICodyRule>).summary;
            delete (updatedRule as Partial<ICodyRule>).atoms;
        } else if (examplesChanged) {
            delete (updatedRule as Partial<ICodyRule>).atoms;
        }

        const updatedCodyRules = await this.updateRule(
            existing.uuid,
            codyRule.uuid,
            updatedRule,
        );

        if (updatedCodyRules && (ruleTextChanged || examplesChanged)) {
            this.scheduleSummaryGeneration(
                organizationAndTeamData,
                updatedRule,
            );
        }

        this.eventEmitter.emit(AuditLogEvents.CODY_RULES, {
            organizationAndTeamData,
            userInfo: userInfo || {
                userId: 'cody-system',
                userEmail: 'cody@kodus.io',
            },
            actionType: ActionType.EDIT,
            repository: { id: updatedRule.repositoryId },
            directory: { id: updatedRule.directoryId },
            oldRule: existingRule,
            newRule: updatedRule,
            ruleTitle: updatedRule.title,
        });

        if (!updatedCodyRules) {
            throw new Error('Could not update rule');
        }

        return updatedCodyRules.rules.find(
            (rule) => rule.uuid === codyRule.uuid,
        );
    }

    async deleteRule(uuid: string, ruleId: string): Promise<boolean> {
        return this.codyRulesRepository.deleteRule(uuid, ruleId);
    }

    async updateRulesStatusByFilter(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
        newStatus: CodyRulesStatus = CodyRulesStatus.DELETED,
    ): Promise<CodyRulesEntity | null> {
        try {
            const result =
                await this.codyRulesRepository.updateRulesStatusByFilter(
                    organizationId,
                    repositoryId,
                    directoryId,
                    newStatus,
                );

            if (result) {
                this.logger.log({
                    message: 'Cody rules status updated successfully by filter',
                    context: CodyRulesService.name,
                    metadata: {
                        organizationId,
                        repositoryId,
                        directoryId,
                        newStatus,
                    },
                });
            }

            return result;
        } catch (error) {
            this.logger.error({
                message: 'Error updating Cody rules status by filter',
                context: CodyRulesService.name,
                error: error,
                metadata: {
                    organizationId,
                    repositoryId,
                    directoryId,
                    newStatus,
                },
            });
            throw error;
        }
    }

    async deleteRuleLogically(
        uuid: string,
        ruleId: string,
    ): Promise<CodyRulesEntity | null> {
        return this.codyRulesRepository.deleteRuleLogically(uuid, ruleId);
    }

    async deleteRuleWithLogging(
        organizationAndTeamData: OrganizationAndTeamData,
        ruleId: string,
        userInfo: UserInfo,
    ): Promise<boolean> {
        try {
            const existing = await this.findByOrganizationId(
                organizationAndTeamData.organizationId,
            );

            if (!existing?.rules?.length) {
                return false;
            }

            const deletedRule = existing.rules.find(
                (rule) => rule.uuid === ruleId,
            );
            if (!deletedRule) {
                return false;
            }

            const rule = await this.deleteRuleLogically(existing.uuid, ruleId);

            this.eventEmitter.emit(AuditLogEvents.CODY_RULES, {
                organizationAndTeamData,
                userInfo,
                actionType: ActionType.DELETE,
                repository: { id: deletedRule.repositoryId },
                oldRule: deletedRule,
                newRule: undefined,
                ruleTitle: deletedRule.title,
            });

            return !!rule;
        } catch (error) {
            this.logger.error({
                message: 'Error deleting rule with logging',
                error: error,
                context: CodyRulesService.name,
                metadata: {
                    ...organizationAndTeamData,
                    ruleId,
                    userInfo,
                },
            });
            throw error;
        }
    }

    /**
     * Resolves the status a rule should actually land in, given the free
     * plan's active-rule quota. Rather than rejecting the request outright,
     * a rule that would push the org over the quota is created/reactivated
     * as `PAUSED` with `lockedByPlan: true` — same "value-forward" pattern
     * as MCP plugins beyond their cap: it's created, just not enforced,
     * and the web UI shows it as Locked with an upgrade CTA instead of
     * making it vanish or hard-blocking the action.
     *
     * Only meaningful when `requestedStatus` is ACTIVE — anything else
     * (paused/pending/rejected/deleted) never consumes quota and passes
     * through unchanged.
     */
    private async resolveStatusWithinPlanLimit(
        organizationAndTeamData: OrganizationAndTeamData,
        requestedStatus: CodyRulesStatus,
        totalRulesAfterOperation: number,
    ): Promise<{ status: CodyRulesStatus; lockedByPlan: boolean }> {
        if (
            requestedStatus !== CodyRulesStatus.ACTIVE ||
            !organizationAndTeamData?.organizationId
        ) {
            return { status: requestedStatus, lockedByPlan: false };
        }

        try {
            const withinLimit =
                await this.codyRulesValidationService.validateRulesLimit(
                    organizationAndTeamData,
                    totalRulesAfterOperation,
                );

            if (withinLimit) {
                return { status: CodyRulesStatus.ACTIVE, lockedByPlan: false };
            }
        } catch (error) {
            this.logger.error({
                message:
                    'Error validating Cody Rules limit - locking rule for safety',
                error: error,
                context: CodyRulesService.name,
                metadata: {
                    organizationAndTeamData,
                    totalRulesAfterOperation,
                },
            });
            // Fail closed: same outcome as hitting the cap, but the rule
            // still gets created/reactivated instead of the request erroring.
        }

        return { status: CodyRulesStatus.PAUSED, lockedByPlan: true };
    }

    private addLanguageToRule(
        codyRule: LibraryCodyRule,
        language: ProgrammingLanguage,
    ): LibraryCodyRule & { language: ProgrammingLanguage } {
        // Returns only the necessary fields
        return {
            uuid: codyRule.uuid,
            title: codyRule.title,
            rule: codyRule.rule,
            why_is_this_important: codyRule.why_is_this_important,
            severity: codyRule.severity,
            tags: codyRule.tags,
            examples: codyRule.examples || [],
            language,
        };
    }

    async getLibraryCodyRules(
        filters?: CodyRuleFilters,
        userId?: string,
    ): Promise<LibraryCodyRule[]> {
        return this.getLibraryCodyRulesInternal(filters, userId, false);
    }

    async getLibraryCodyRulesWithFeedback(
        filters?: CodyRuleFilters,
        userId?: string,
    ): Promise<LibraryCodyRule[]> {
        return this.getLibraryCodyRulesInternal(filters, userId, true);
    }

    private async getLibraryCodyRulesInternal(
        filters?: CodyRuleFilters,
        userId?: string,
        includeFeedback: boolean = false,
    ): Promise<LibraryCodyRule[]> {
        try {
            // Nova estrutura é um array direto
            if (!Array.isArray(libraryCodyRules)) {
                return [];
            }

            const validRules = libraryCodyRules
                .filter(
                    (rule) => rule && typeof rule === 'object' && rule.title,
                )
                .map((rule: any) => {
                    return {
                        ...rule,
                        buckets: rule.buckets || [],
                        type: CodyRulesType.STANDARD,
                    };
                });

            // Aplica filtros se houver
            let filteredRules = validRules;
            if (filters) {
                filteredRules = validRules.filter((rule) => {
                    // Filtro por título
                    if (
                        filters.title &&
                        !rule.title
                            .toLowerCase()
                            .includes(filters.title.toLowerCase())
                    ) {
                        return false;
                    }

                    // Filtro por severidade
                    if (
                        filters.severity &&
                        rule.severity?.toLowerCase() !==
                            filters.severity?.toLowerCase()
                    ) {
                        return false;
                    }

                    // Filtro por tags
                    if (filters.tags && filters.tags.length > 0) {
                        const ruleTags = rule.tags || [];
                        const hasMatchingTag = filters.tags.some((filterTag) =>
                            ruleTags.some((ruleTag) =>
                                ruleTag
                                    .toLowerCase()
                                    .includes(filterTag.toLowerCase()),
                            ),
                        );
                        if (!hasMatchingTag) {
                            return false;
                        }
                    }

                    // Filtro por linguagem
                    if (filters.language) {
                        const filterLanguage = String(
                            filters.language,
                        ).toLowerCase();
                        const ruleLanguage = String(
                            rule.language || '',
                        ).toLowerCase();

                        // Rules sem linguagem são consideradas "agnósticas" e passam no filtro
                        if (ruleLanguage && ruleLanguage !== filterLanguage) {
                            return false;
                        }
                    }

                    // Filtro por buckets
                    if (filters.buckets && filters.buckets.length > 0) {
                        const ruleBuckets = rule.buckets || [];
                        const hasMatchingBucket = filters.buckets.some(
                            (filterBucket) =>
                                ruleBuckets.includes(filterBucket),
                        );
                        if (!hasMatchingBucket) {
                            return false;
                        }
                    }

                    // Filtro por plug_and_play
                    if (
                        filters.plug_and_play !== undefined &&
                        filters.plug_and_play !== null
                    ) {
                        if (rule.plug_and_play !== filters.plug_and_play) {
                            return false;
                        }
                    }

                    return true;
                });
            }

            // Se deve incluir feedback, busca dados de feedback
            if (includeFeedback) {
                try {
                    const feedbackData =
                        await this.ruleLikeService.getAllRulesWithFeedback(
                            userId,
                        );

                    const feedbackMap = new Map(
                        feedbackData.map((f) => [f.ruleId, f]),
                    );

                    return filteredRules.map((rule) => {
                        const feedback = feedbackMap.get(rule.uuid);
                        return {
                            ...rule,
                            positiveCount: feedback?.positiveCount || 0,
                            negativeCount: feedback?.negativeCount || 0,
                            // Só inclui userFeedback se userId foi fornecido
                            userFeedback: userId
                                ? feedback?.userFeedback || null
                                : null,
                        };
                    });
                } catch (error) {
                    this.logger.error({
                        message: 'Error fetching feedback data',
                        error: error,
                        context: CodyRulesService.name,
                        metadata: {
                            userId,
                            includeFeedback,
                        },
                    });
                    // Se erro ao buscar feedback, retorna sem feedback
                    return filteredRules;
                }
            }

            return filteredRules;
        } catch (error) {
            this.logger.error({
                message: 'Error in getLibraryCodyRules',
                error: error,
                context: CodyRulesService.name,
                metadata: {
                    filters,
                    userId,
                    includeFeedback,
                },
            });
            return [];
        }
    }

    async getLibraryCodyRulesBuckets(): Promise<BucketInfo[]> {
        try {
            if (!Array.isArray(bucketsData)) {
                return [];
            }

            // Create a map of rule counts per bucket for better performance O(M+N)
            const bucketRuleCounts = libraryCodyRules.reduce(
                (acc, rule: LibraryCodyRule) => {
                    if (rule.buckets?.length) {
                        rule.buckets.forEach((bucketSlug: string) => {
                            acc.set(bucketSlug, (acc.get(bucketSlug) || 0) + 1);
                        });
                    }
                    return acc;
                },
                new Map<string, number>(),
            );

            const bucketsWithCount: BucketInfo[] = bucketsData.map(
                (bucket) => ({
                    slug: bucket.slug,
                    title: bucket.title,
                    description: bucket.description,
                    rulesCount: bucketRuleCounts.get(bucket.slug) || 0,
                }),
            );

            return bucketsWithCount;
        } catch (error) {
            this.logger.error({
                message: 'Error in getLibraryCodyRulesBuckets',
                error: error,
                context: CodyRulesService.name,
            });
            return [];
        }
    }

    async getRecommendedRulesBySuggestions(
        organizationAndTeamData: OrganizationAndTeamData,
        repositoryId: string,
        repoLanguage?: string,
    ): Promise<LibraryCodyRule[]> {
        try {
            const recentPRs =
                await this.pullRequestsRepository.findRecentByRepositoryId(
                    organizationAndTeamData.organizationId,
                    repositoryId,
                    10,
                );

            if (!recentPRs || recentPRs.length === 0) {
                this.logger.log({
                    message: 'No recent PRs found for recommendations',
                    context: CodyRulesService.name,
                    metadata: {
                        organizationId: organizationAndTeamData.organizationId,
                        repositoryId,
                    },
                });
                return [];
            }

            const allSuggestions = recentPRs
                .flatMap((pr) => {
                    const prObj = pr.toObject();
                    return (
                        prObj.files?.flatMap(
                            (file) =>
                                file.suggestions?.map((suggestion) => ({
                                    label: suggestion.label,
                                    severity: suggestion.severity,
                                    suggestionContent:
                                        suggestion.suggestionContent,
                                    oneSentenceSummary:
                                        suggestion.oneSentenceSummary,
                                })) || [],
                        ) || []
                    );
                })
                .filter(Boolean)
                .slice(0, 50);

            if (allSuggestions.length === 0) {
                this.logger.log({
                    message: 'No suggestions found in recent PRs',
                    context: CodyRulesService.name,
                    metadata: {
                        organizationId: organizationAndTeamData.organizationId,
                        repositoryId,
                    },
                });
                return [];
            }

            const filteredLibrary = (libraryCodyRules as LibraryCodyRule[])
                .filter((rule) => {
                    if (!repoLanguage)
                        return !rule.language || rule.language === '';
                    return (
                        !rule.language ||
                        rule.language === '' ||
                        rule.language === repoLanguage
                    );
                })
                .map((rule) => ({
                    uuid: rule.uuid,
                    title: rule.title,
                    rule: rule.rule,
                    buckets: rule.buckets,
                    severity: rule.severity,
                }));

            const byokConfigValue =
                await this.permissionValidationService.getBYOKConfig(
                    organizationAndTeamData,
                );

            const mainRun = 'codyRulesRecommendationFromSuggestions';

            const systemPrompt = `You are a code quality expert analyzing past code review suggestions to recommend relevant Cody Rules.

## What are Cody Rules?
Cody Rules are reusable code review guidelines that help enforce best practices. Each rule has:
- title: Short descriptive name
- rule: The guideline to follow
- buckets: Categories like "error-handling", "security-hardening", "maintainability"
- severity: low | medium | high | critical
- language: Programming language (empty = language-agnostic)

## Your Task
Analyze the provided code review suggestions and identify PATTERNS of issues.
Then recommend rules from the library that would help prevent these patterns.

## Important Guidelines
1. Look for RECURRING patterns, not one-off issues
2. Recommend rules that address the ROOT CAUSE, not symptoms
3. Prefer rules with higher severity (critical/high) when relevant
4. Maximum 7 recommendations
5. Each recommendation needs a clear reason explaining the pattern you identified

## Output Format
Return ONLY a JSON object (no markdown, no code fences):
{
  "recommendations": [
    {
      "uuid": "rule-uuid-from-library",
      "reason": "Pattern identified: X. This rule helps because Y.",
      "relevanceScore": 8
    }
  ]
}`;

            const userPrompt = `## Recent Code Review Suggestions (patterns to analyze):
${JSON.stringify(allSuggestions)}

## Available Rules Library (filtered by language):
${JSON.stringify(filteredLibrary)}

Analyze the suggestions and recommend the most relevant rules.`;

            const result = await runStructuredReviewCall({
                byokConfig: byokConfigValue ?? undefined,
                schema: codyRulesRecommendationSchema,
                system: systemPrompt,
                user: userPrompt,
                runName: `${CodyRulesService.name}::${mainRun}`,
                organizationId: organizationAndTeamData.organizationId,
                attrs: {
                    repositoryId,
                    suggestionsCount: allSuggestions.length,
                    libraryRulesCount: filteredLibrary.length,
                },
                observabilityService: this.observabilityService,
            });

            if (
                !result?.recommendations ||
                result.recommendations.length === 0
            ) {
                return [];
            }

            const recommendedUUIDs = result.recommendations.map((r) => r.uuid);
            const recommendedRules = (
                libraryCodyRules as LibraryCodyRule[]
            ).filter((rule) => recommendedUUIDs.includes(rule.uuid));

            return recommendedRules;
        } catch (error) {
            this.logger.error({
                message: 'Error in getRecommendedRulesBySuggestions',
                error: error,
                context: CodyRulesService.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    repositoryId,
                },
            });
            return [];
        }
    }

    async createOrUpdateMemory(
        organizationAndTeamData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
        userInfo?: UserInfo,
    ): Promise<CreateOrUpdateMemoryResult | null> {
        try {
            const resolution = await this.resolveGeneratedMemoryAction(
                organizationAndTeamData,
                memory,
            );

            if (resolution?.action === 'skip' && resolution.existingMemory) {
                return {
                    rule: resolution.existingMemory,
                    action: 'skipped',
                    requiresApproval: false,
                    link: this.buildMemoryLink(
                        resolution.existingMemory.repositoryId,
                        resolution.existingMemory.uuid,
                        organizationAndTeamData.teamId,
                        resolution.existingMemory.status,
                    ),
                };
            }

            const memoryToPersist =
                resolution && resolution.action !== 'skip'
                    ? resolution.memoryToPersist
                    : memory;

            const requiresApproval =
                await this.shouldRequireApprovalForGeneratedMemory(
                    organizationAndTeamData,
                    memoryToPersist,
                );

            const targetMemory =
                resolution?.action === 'update'
                    ? resolution.targetMemory
                    : null;
            const isTargetUserOrigin = !isGeneratedCodyRuleOrigin(
                targetMemory?.origin,
            );
            const isTargetGeneratedNeedsApproval =
                isGeneratedCodyRuleOrigin(targetMemory?.origin) &&
                requiresApproval;

            if (
                targetMemory?.uuid &&
                (isTargetUserOrigin || isTargetGeneratedNeedsApproval)
            ) {
                return await this.createPendingRequest(
                    organizationAndTeamData,
                    memoryToPersist,
                    userInfo,
                    CodyRuleRequestType.UPDATE,
                    targetMemory.uuid,
                );
            }

            if (requiresApproval && !memoryToPersist.uuid) {
                return await this.createPendingRequest(
                    organizationAndTeamData,
                    memoryToPersist,
                    userInfo,
                    CodyRuleRequestType.CREATE,
                );
            }

            const operation =
                resolution?.action === 'update' ? 'update' : 'create';

            const { rule, linkOverride } =
                await this.createOrUpdateMemoryWithCentralizedRouting(
                    organizationAndTeamData,
                    memoryToPersist,
                    userInfo,
                    operation,
                    requiresApproval,
                );

            if (!rule) return null;

            const action =
                operation === 'update'
                    ? ('updated' as const)
                    : ('created' as const);

            return {
                rule,
                action,
                requiresApproval,
                link:
                    linkOverride ||
                    this.buildMemoryLink(
                        rule.repositoryId,
                        rule.uuid,
                        organizationAndTeamData.teamId,
                        rule.status,
                    ),
            };
        } catch (error) {
            this.logger.error({
                message: 'Error in createOrUpdateMemory',
                error: error,
                context: CodyRulesService.name,
                metadata: {
                    organizationAndTeamData,
                    memory,
                    userInfo,
                },
            });
            throw error;
        }
    }

    private async createOrUpdateMemoryWithCentralizedRouting(
        organizationAndTeamData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
        userInfo: UserInfo | undefined,
        operation: 'create' | 'update',
        requiresApproval: boolean,
    ): Promise<{
        rule: Partial<ICodyRule> | ICodyRule | null;
        linkOverride?: string;
    }> {
        const payload = {
            ...this.getBaseMemoryPayload(memory),
            status: requiresApproval
                ? CodyRulesStatus.PENDING
                : memory.status || CodyRulesStatus.ACTIVE,
        };

        const ccp = await this.resolveCentralizedConfigPrService();
        const memoryGroupFolderName = await ccp.resolveDirectoryGroupFolderName(
            organizationAndTeamData,
            payload.repositoryId,
            payload.directoryId,
        );
        const centralizedPr = await ccp.createMutationPullRequestIfEnabled(
            buildCodyRuleCentralizedMutationRequest({
                centralizedConfigPrService: ccp,
                organizationAndTeamData,
                repositoryId: payload.repositoryId,
                groupFolderName: memoryGroupFolderName ?? undefined,
                ruleContent: payload,
                ruleType: CodyRulesType.MEMORY,
                operation,
            }),
        );

        if (centralizedPr.mode !== 'centralized-pr') {
            const rule = await this.createOrUpdate(
                organizationAndTeamData,
                payload,
                userInfo,
            );

            return { rule };
        }

        const persistedPending =
            await this.persistMemoryCentralizedPendingStatus(
                organizationAndTeamData,
                payload,
                operation,
                userInfo,
            );

        return {
            rule: persistedPending || payload,
            linkOverride: centralizedPr.prUrl || '',
        };
    }

    private async persistMemoryCentralizedPendingStatus(
        organizationAndTeamData: OrganizationAndTeamData,
        memoryPayload: Partial<ICodyRule>,
        operation: 'create' | 'update',
        userInfo?: UserInfo,
    ): Promise<Partial<ICodyRule> | ICodyRule | null> {
        if (!memoryPayload.title || !memoryPayload.repositoryId) {
            return null;
        }

        const ccp = await this.resolveCentralizedConfigPrService();
        const repositoryFolder = await ccp.resolveRepositoryFolderName(
            organizationAndTeamData,
            memoryPayload.repositoryId,
        );

        const centralizedPath = buildCodyRuleCentralizedFilePath({
            centralizedConfigPrService: ccp,
            repositoryFolder,
            rulesDirectory: 'memories',
            ruleContent: memoryPayload,
        });

        if (operation === 'update' && !memoryPayload.uuid) {
            return null;
        }

        return this.createOrUpdate(
            organizationAndTeamData,
            {
                ...(memoryPayload as CreateCodyRuleDto),
                type: CodyRulesType.MEMORY,
                centralizedConfig: {
                    path: centralizedPath,
                    status:
                        operation === 'create'
                            ? CodyRuleCentralizedStatus.PENDING_ADD
                            : CodyRuleCentralizedStatus.PENDING_EDIT,
                },
            },
            userInfo,
        );
    }

    private async shouldRequireApprovalForGeneratedMemory(
        organizationAndTeamData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
    ): Promise<boolean> {
        if (
            !memory.origin ||
            !organizationAndTeamData?.organizationId ||
            !organizationAndTeamData?.teamId
        ) {
            return false;
        }

        try {
            const mergedConfig =
                await this.codeBaseConfigService.getSimpleConfig(
                    organizationAndTeamData,
                    {
                        repositoryId: memory.repositoryId,
                        directoryId: memory.directoryId,
                    },
                );

            return requiresKnowledgeApproval(
                mergedConfig.codyKnowledgeApproval,
                memory.origin,
            );
        } catch (error) {
            this.logger.error({
                message:
                    'Error resolving codyKnowledgeApproval, defaulting to active memories',
                error,
                context: CodyRulesService.name,
                metadata: {
                    organizationAndTeamData,
                    repositoryId: memory.repositoryId,
                    directoryId: memory.directoryId,
                },
            });
            return false;
        }
    }

    private async resolveGeneratedMemoryAction(
        organizationAndTeamData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
    ): Promise<
        | {
              action: 'create';
              memoryToPersist: ICodyRuleMemory;
          }
        | {
              action: 'skip';
              existingMemory: Partial<ICodyRule>;
          }
        | {
              action: 'update';
              memoryToPersist: ICodyRuleMemory;
              targetMemory: Partial<ICodyRule>;
          }
        | null
    > {
        if (!isGeneratedCodyRuleOrigin(memory.origin) || memory.uuid) {
            return null;
        }

        try {
            const entity = await this.findByOrganizationId(
                organizationAndTeamData.organizationId,
            );

            const existingMemories = (entity?.rules || []).filter(
                (rule) =>
                    rule.type === CodyRulesType.MEMORY &&
                    rule.status === CodyRulesStatus.ACTIVE,
            );

            if (!existingMemories.length) {
                return {
                    action: 'create',
                    memoryToPersist: memory,
                };
            }

            const result = await this.evaluateMemoryActionViaLLM(
                organizationAndTeamData,
                memory,
                existingMemories,
            );

            if (!result?.action || result.action === 'create') {
                return { action: 'create', memoryToPersist: memory };
            }

            const matchedMemory =
                existingMemories.find(
                    (m) => m.uuid === result.targetMemoryUuid,
                ) ||
                existingMemories.find((m) =>
                    this.isExactMemoryMatch(m, memory),
                );

            if (result.action === 'skip' && matchedMemory) {
                return { action: 'skip', existingMemory: matchedMemory };
            }

            if (result.action === 'update' && matchedMemory?.uuid) {
                return {
                    action: 'update',
                    memoryToPersist: {
                        ...memory,
                        uuid: matchedMemory.uuid,
                        title: result.updatedTitle?.trim() || memory.title,
                        rule: result.updatedRule?.trim() || memory.rule,
                    },
                    targetMemory: matchedMemory,
                };
            }

            return { action: 'create', memoryToPersist: memory };
        } catch (error) {
            this.logger.error({
                message:
                    'Error resolving generated memory action - defaulting to create',
                error,
                context: CodyRulesService.name,
                metadata: {
                    organizationAndTeamData,
                    memory,
                },
            });

            return {
                action: 'create',
                memoryToPersist: memory,
            };
        }
    }

    private async createPendingRequest(
        orgData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
        userInfo: UserInfo | undefined,
        requestType: CodyRuleRequestType,
        targetRuleUuid?: string,
    ): Promise<CreateOrUpdateMemoryResult | null> {
        const rule = await this.createOrUpdate(
            orgData,
            {
                ...this.getBaseMemoryPayload(memory),
                uuid: undefined,
                status: CodyRulesStatus.PENDING,
                requestType,
                targetRuleUuid,
            },
            userInfo,
        );

        return rule
            ? {
                  rule,
                  action: 'created',
                  requiresApproval: true,
                  link: this.buildMemoryLink(
                      rule.repositoryId,
                      rule.uuid,
                      orgData.teamId,
                      rule.status,
                  ),
              }
            : null;
    }

    private getBaseMemoryPayload(memory: ICodyRuleMemory) {
        return {
            ...memory,
            path: memory.path || null,
            origin: memory.origin ?? CodyRulesOrigin.MANUAL,
            severity: CodyRuleSeverity.MEDIUM,
            examples: [],
            inheritance: {
                inheritable: true,
                exclude: [],
                include: [],
            },
        };
    }

    private isExactMemoryMatch(
        existingMemory: Partial<ICodyRule>,
        incomingMemory: ICodyRuleMemory,
    ): boolean {
        return (
            this.normalizeMemoryText(existingMemory.title) ===
                this.normalizeMemoryText(incomingMemory.title) &&
            this.normalizeMemoryText(existingMemory.rule) ===
                this.normalizeMemoryText(incomingMemory.rule)
        );
    }

    private normalizeMemoryText(value?: string): string {
        return (value || '').toLowerCase().trim().replace(/\s+/g, ' ');
    }

    private async evaluateMemoryActionViaLLM(
        organizationAndTeamData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
        existingMemories: Partial<ICodyRule>[],
    ) {
        const byokConfigValue =
            await this.permissionValidationService.getBYOKConfig(
                organizationAndTeamData,
            );
        const runName = 'codyMemoryResolution';

        const incomingMemory = {
            title: memory.title,
            rule: memory.rule,
            repositoryId: memory.repositoryId,
            directoryId: memory.directoryId,
            path: memory.path || undefined,
        };

        const existingForPrompt = existingMemories.map((existingMemory) => ({
            uuid: existingMemory.uuid,
            title: existingMemory.title,
            rule: existingMemory.rule,
            repositoryId: existingMemory.repositoryId,
            directoryId: existingMemory.directoryId,
            path: existingMemory.path,
        }));

        const result = await runStructuredReviewCall({
            byokConfig: byokConfigValue ?? undefined,
            schema: codyMemoryResolutionSchema,
            system: prompt_codyMemoryResolution_system(),
            user: prompt_codyMemoryResolution_user({
                incomingMemory,
                existingMemories: existingForPrompt,
            }),
            runName,
            organizationId: organizationAndTeamData.organizationId,
            attrs: {
                existingMemoriesCount: existingMemories.length,
            },
            observabilityService: this.observabilityService,
        });

        return result;
    }

    async findMemories(
        organizationAndTeamData: OrganizationAndTeamData,
        filters?: FindMemoriesFilters,
    ): Promise<FindMemoriesResult[]> {
        try {
            const entity = await this.findByOrganizationId(
                organizationAndTeamData.organizationId,
            );

            if (!entity?.rules?.length) {
                return [];
            }

            const safeLimit = Math.min(Math.max(filters?.limit ?? 20, 1), 20);
            const normalizedKeywords = (filters?.keywords || [])
                .map((keyword) => keyword?.trim())
                .filter((keyword): keyword is string => Boolean(keyword));
            const normalizedPathFilter = filters?.path?.trim();

            const inheritedMemories =
                this.codyRulesValidationService.getMemoryRulesForContext(
                    normalizedPathFilter || null,
                    entity.rules,
                    {
                        repositoryId: filters?.repositoryId,
                        directoryId: filters?.repositoryId
                            ? filters?.directoryId
                            : undefined,
                    },
                );

            const filteredMemories = inheritedMemories
                .filter((rule): rule is ICodyRule => {
                    if (normalizedKeywords.length === 0) {
                        return true;
                    }

                    const haystack = `${rule.title || ''} ${rule.rule || ''}`
                        .trim()
                        .toLowerCase();

                    if (!haystack) {
                        return false;
                    }

                    return normalizedKeywords.some((keyword) =>
                        haystack.includes(keyword.toLowerCase()),
                    );
                })
                .sort((a, b) => {
                    const aTime = a.createdAt
                        ? new Date(a.createdAt).getTime()
                        : 0;
                    const bTime = b.createdAt
                        ? new Date(b.createdAt).getTime()
                        : 0;

                    return bTime - aTime;
                })
                .slice(0, safeLimit)
                .map((memory) => ({
                    uuid: memory.uuid,
                    title: memory.title,
                    rule: memory.rule,
                    repositoryId: memory.repositoryId,
                    directoryId: memory.directoryId || undefined,
                    path: memory.path || undefined,
                    createdAt: memory.createdAt?.toISOString(),
                    link: this.buildMemoryLink(
                        memory.repositoryId,
                        memory.uuid,
                        organizationAndTeamData.teamId,
                        memory.status,
                    ),
                }));

            return filteredMemories;
        } catch (error) {
            this.logger.error({
                message: 'Error in findMemories',
                error,
                context: CodyRulesService.name,
                metadata: {
                    organizationAndTeamData,
                    filters,
                },
            });

            throw error;
        }
    }

    private buildMemoryLink(
        repositoryId: string | null | undefined,
        ruleId: string | undefined,
        teamId?: string,
        status?: CodyRulesStatus,
    ): string {
        return buildCodyRuleAppLink({
            repositoryId,
            ruleId,
            teamId,
            status,
            tab: 'memories',
        });
    }
}
