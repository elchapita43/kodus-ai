import * as yaml from 'js-yaml';

import {
    CentralizedConfigPrService,
    CentralizedMutationPullRequestRequest,
} from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    ICodyRule,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

export type CodyRuleMutationOperation = 'create' | 'update' | 'delete';

interface BuildCodyRuleCentralizedMutationRequestParams {
    centralizedConfigPrService: CentralizedConfigPrService;
    organizationAndTeamData: OrganizationAndTeamData;
    repositoryId?: string;
    groupFolderName?: string;
    ruleContent: Partial<ICodyRule>;
    ruleType: CodyRulesType;
    operation: CodyRuleMutationOperation;
}

export function buildCodyRuleCentralizedMutationRequest(
    params: BuildCodyRuleCentralizedMutationRequestParams,
): CentralizedMutationPullRequestRequest {
    const isMemory = params.ruleType === CodyRulesType.MEMORY;
    const rulesDirectory = isMemory ? 'memories' : 'review';
    const operationLabel =
        params.operation === 'delete' ? 'remove' : params.operation;

    return {
        organizationAndTeamData: params.organizationAndTeamData,
        repositoryId: params.repositoryId,
        files: ({ repositoryFolder }) => {
            const path = buildCodyRuleCentralizedFilePath({
                centralizedConfigPrService: params.centralizedConfigPrService,
                repositoryFolder,
                rulesDirectory,
                ruleContent: params.ruleContent,
                groupFolderName: params.groupFolderName,
            });

            if (params.operation === 'delete') {
                return [{ path, operation: 'delete' }];
            }

            return [
                {
                    path,
                    content: formatRuleToYaml(params.ruleContent),
                    operation: 'upsert',
                },
            ];
        },
        title: ({ repositoryFolder }) =>
            `${params.operation === 'delete' ? 'Remove' : 'Update'} ${isMemory ? 'Cody Memory' : 'Cody Rule'} from ${repositoryFolder}`,
        description:
            params.operation === 'delete'
                ? 'This pull request proposes removing a centralized Cody file.'
                : 'This pull request proposes a centralized Cody configuration change.',
        commitMessage: `${operationLabel} ${isMemory ? 'memory' : 'rule'} via centralized config`,
        sourceBranch: () =>
            `codus-centralized-${params.ruleType}-${params.operation}-${Date.now()}`,
    };
}

export function buildCodyRuleCentralizedFilePath(params: {
    centralizedConfigPrService: CentralizedConfigPrService;
    repositoryFolder: string;
    rulesDirectory: string;
    ruleContent: Partial<ICodyRule>;
    groupFolderName?: string;
}): string {
    const normalizedPath = normalizeCentralizedPath(
        params.ruleContent.centralizedConfig?.path,
    );

    if (normalizedPath) {
        return normalizedPath;
    }

    const fileName = params.centralizedConfigPrService.buildRuleFileName(
        params.ruleContent.title,
        params.ruleContent.uuid,
    );

    if (params.groupFolderName) {
        return params.centralizedConfigPrService.buildDirectoryGroupRulesPath(
            params.repositoryFolder,
            params.groupFolderName,
            params.rulesDirectory,
            fileName,
        );
    }

    return params.centralizedConfigPrService.buildCentralizedPath({
        repositoryFolder: params.repositoryFolder,
        relativePath: `.cody-rules/${params.rulesDirectory}/${fileName}`,
    });
}

function normalizeCentralizedPath(path?: string): string | null {
    const normalized = path?.trim();

    if (
        !normalized ||
        normalized.startsWith('/') ||
        normalized.includes('..')
    ) {
        return null;
    }

    return normalized;
}

export function formatRuleToYaml(rule: Partial<ICodyRule>): string {
    const ruleForYaml = {
        title: rule.title,
        rule: rule.rule,
        ...(rule.severity ? { severity: rule.severity } : {}),
        ...(rule.scope ? { scope: rule.scope } : {}),
        ...(rule.path ? { path: rule.path } : {}),
        ...(rule.examples ? { examples: rule.examples } : {}),
        ...(rule.inheritance ? { inheritance: rule.inheritance } : {}),
        // Present = enforced. A paused rule stays in the config but is not
        // enforced; absence means enabled (keeps active-rule files unchanged).
        ...(rule.status === CodyRulesStatus.PAUSED ? { enabled: false } : {}),
    };

    return yaml.dump(ruleForYaml);
}
