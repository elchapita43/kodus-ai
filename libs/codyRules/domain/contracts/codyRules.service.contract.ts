import { UserInfo } from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';
import {
    BucketInfo,
    CodyRuleFilters,
    LibraryCodyRule,
} from '@libs/core/infrastructure/config/types/general/codyRules.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { CreateCodyRuleDto } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import { CodyRulesEntity } from '../entities/codyRules.entity';
import {
    FindMemoriesFilters,
    FindMemoriesResult,
    ICodyRule,
    ICodyRuleDetector,
    ICodyRuleMemory,
    CodyRulesStatus,
} from '../interfaces/codyRules.interface';
import { ICodyRulesRepository } from './codyRules.repository.contract';

export const CODY_RULES_SERVICE_TOKEN = 'CODY_RULES_SERVICE_TOKEN';

export type MemoryCreationAction = 'created' | 'updated' | 'skipped';

export interface CreateOrUpdateMemoryResult {
    rule: Partial<ICodyRule> | ICodyRule;
    action: MemoryCreationAction;
    requiresApproval: boolean;
    link: string;
}

export interface ICodyRulesService extends ICodyRulesRepository {
    createOrUpdate(
        organizationAndTeamData: OrganizationAndTeamData,
        codyRule: CreateCodyRuleDto,
        userInfo?: UserInfo,
    ): Promise<Partial<ICodyRule> | ICodyRule | null>;

    getLibraryCodyRules(
        filters?: CodyRuleFilters,
        userId?: string,
    ): Promise<LibraryCodyRule[]>;
    getLibraryCodyRulesWithFeedback(
        filters?: CodyRuleFilters,
        userId?: string,
    ): Promise<LibraryCodyRule[]>;

    getLibraryCodyRulesBuckets(): Promise<BucketInfo[]>;

    findRulesByDirectory(
        organizationId: string,
        repositoryId: string,
        directoryId: string,
    ): Promise<Partial<ICodyRule>[]>;
    updateRulesStatusByFilter(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
        newStatus?: CodyRulesStatus,
    ): Promise<CodyRulesEntity | null>;

    deleteRuleWithLogging(
        organizationAndTeamData: OrganizationAndTeamData,
        ruleId: string,
        userInfo: UserInfo,
    ): Promise<boolean>;

    updateRuleWithLogging(
        organizationAndTeamData: OrganizationAndTeamData,
        codyRule: CreateCodyRuleDto,
        userInfo?: UserInfo,
    ): Promise<Partial<ICodyRule> | ICodyRule | null>;

    updateRuleReferences(
        organizationId: string,
        ruleId: string,
        references: {
            contextReferenceId?: string;
            // Todos os outros campos de referência foram movidos para Context OS
        },
    ): Promise<ICodyRule | null>;

    /**
     * Persist the T0 compiled detector onto an embedded rule (#1449). Passing
     * `null` clears it (rule reverts to semantic). Mirrors updateRuleReferences.
     */
    updateRuleDetector(
        organizationId: string,
        ruleId: string,
        detector: ICodyRuleDetector | null,
    ): Promise<ICodyRule | null>;

    getRulesLimitStatus(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<{
        total: number;
    }>;

    countRulesByRepository(
        organizationId: string,
    ): Promise<
        Array<{
            repositoryId: string;
            directoryId: string | null;
            count: number;
        }>
    >;

    getRecommendedRulesBySuggestions(
        organizationAndTeamData: OrganizationAndTeamData,
        repositoryId: string,
        repoLanguage?: string,
    ): Promise<LibraryCodyRule[]>;

    createOrUpdateMemory(
        organizationAndTeamData: OrganizationAndTeamData,
        memory: ICodyRuleMemory,
        userInfo?: UserInfo,
    ): Promise<CreateOrUpdateMemoryResult | null>;

    findMemories(
        organizationAndTeamData: OrganizationAndTeamData,
        filters?: FindMemoriesFilters,
    ): Promise<FindMemoriesResult[]>;
}
