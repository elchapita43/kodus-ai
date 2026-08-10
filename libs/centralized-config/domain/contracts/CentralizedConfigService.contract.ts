import { CodusConfigFile } from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    ICodyRule,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { DeepPartial } from 'typeorm';

export const CENTRALIZED_CONFIG_SERVICE_TOKEN =
    'CENTRALIZED_CONFIG_SERVICE_TOKEN';

export interface IConfigFileMeta {
    centralizedDirectoryPath?: string;
    repositoryId?: string;
    directoryPath?: string;
    directoryPaths?: string[];
}

export interface ICodyRuleFileMeta {
    centralizedDirectoryPath: string; // Path in centralized repo, e.g., "org-a/.cody-rules/memories"
    repositoryId?: string; // Target repository ID or undefined for global
    directoryPath?: string; // Target directory path (canonical: first folder of the group) or undefined for repo-level
    directoryPaths?: string[]; // All folder paths of the directory group when the rule lives inside one
    ruleType: CodyRulesType; // MEMORY or STANDARD based on subdirectory
    ruleFilePath: string; // Full path in centralized repo, e.g., "org-a/.cody-rules/memories/logging.yml"
    path: string; // Canonical centralized source path for DB tracking, e.g., "org-a/.cody-rules/memories/logging.yml"
}

export interface ICentralizedConfigService {
    /**
     * Validates if centralized config is enabled and properly configured for the team
     */
    validateCentralizedConfig(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        repository?: { name: string; id: string };
    }): Promise<{
        success: boolean;
        message: string;
    }>;

    /**
     * Gets the centralized config repository configuration
     */
    getCentralizedConfigRepository(
        organizationAndTeamData: OrganizationAndTeamData,
    ): Promise<{ name: string; id: string }>;

    /**
     * Discovers all codus-config.yml files in the centralized config repository
     */
    discoverConfigFiles(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        repository: { name: string; id: string };
    }): Promise<IConfigFileMeta[]>;

    /**
     * Fetches a specific config file from the repository
     */
    fetchConfigFile(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        repository: { name: string; id: string };
        dir?: string;
    }): Promise<CodusConfigFile | null>;

    /**
     * Synchronizes config files by updating parameters based on discovered files
     */
    synchronizeConfigs(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        configFiles: IConfigFileMeta[];
        actor: {
            organizationId: string;
            source: string;
            userEmail: string;
            userId: string;
        };
    }): Promise<{
        success: boolean;
        message: string;
    }>;

    /**
     * Removes stale configs that are no longer present in the repository
     */
    removeStaleConfigs(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        configFiles: IConfigFileMeta[];
        actor: {
            organizationId: string;
            source: string;
            userEmail: string;
            userId: string;
        };
    }): Promise<{
        success: boolean;
        message: string;
    }>;

    /**
     * Discovers all .cody-rules YAML files in the centralized config repository
     */
    discoverCodyRulesFiles(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        repository: { name: string; id: string };
    }): Promise<ICodyRuleFileMeta[]>;

    /**
     * Fetches and parses a Cody rule file from the centralized repository
     */
    fetchCodyRuleFile(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        repository: { name: string; id: string };
        filePath: string;
    }): Promise<DeepPartial<ICodyRule> | null>;

    /**
     * Synchronizes Cody rules from centralized repository to target scopes
     */
    synchronizeCodyRules(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        ruleFiles: ICodyRuleFileMeta[];
        actor: {
            organizationId: string;
            source: string;
            userEmail: string;
            userId: string;
        };
    }): Promise<{
        success: boolean;
        message: string;
        syncedRuleCount?: number;
        failureDetails?: Array<{ file: string; error: string }>;
    }>;

    /**
     * Removes stale Cody rules that are no longer present in centralized repository
     */
    removeStaleCodyRules(params: {
        organizationAndTeamData: OrganizationAndTeamData;
        ruleFiles: ICodyRuleFileMeta[];
        actor: {
            organizationId: string;
            source: string;
            userEmail: string;
            userId: string;
        };
    }): Promise<{
        success: boolean;
        message: string;
        removedRuleCount?: number;
    }>;
}
