import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';

import {
    CONTEXT_REFERENCE_SERVICE_TOKEN,
    IContextReferenceService,
} from '@libs/ai-engine/domain/contextReference/contracts/context-reference.service.contract';
import { ParametersKey } from '@libs/core/domain/enums/parameters-key.enum';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    ICodyRule,
    CodyRulesStatus,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';

import { enrichRulesWithContextReferences } from './utils/enrich-rules-with-context-references.util';
import { CodyRulesValidationService } from '@libs/ee/codyRules/service/cody-rules-validation.service';

type CodyRuleWithInheritance = Partial<ICodyRule> & {
    inherited?: 'global' | 'repository' | 'directory';
    excluded?: boolean;
};

@Injectable()
export class GetInheritedRulesCodyRulesUseCase {
    private readonly logger = createLogger(
        GetInheritedRulesCodyRulesUseCase.name,
    );
    constructor(
        private readonly codyRulesValidationService: CodyRulesValidationService,
        @Inject(PARAMETERS_SERVICE_TOKEN)
        private readonly parametersService: IParametersService,
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
        @Inject(CONTEXT_REFERENCE_SERVICE_TOKEN)
        private readonly contextReferenceService: IContextReferenceService,
    ) {}

    async execute(
        organizationAndTeamData: OrganizationAndTeamData,
        repositoryId: string,
        directoryId?: string,
    ): Promise<{
        globalRules: Partial<CodyRuleWithInheritance>[];
        repoRules: Partial<CodyRuleWithInheritance>[];
        directoryRules: Partial<CodyRuleWithInheritance>[];
    }> {
        if (!repositoryId || repositoryId === 'global') {
            return {
                globalRules: [],
                repoRules: [],
                directoryRules: [],
            };
        }

        const existing = await this.codyRulesService.findByOrganizationId(
            organizationAndTeamData.organizationId,
        );

        if (!existing) {
            return {
                globalRules: [],
                repoRules: [],
                directoryRules: [],
            };
        }

        // severity is lower-cased to match the scope-local listing path
        // (`CodyRulesService.find()` normalizes on read). Without this the
        // same rule reaches the page lower-cased via one endpoint and
        // raw-cased via the other, so a strict severity compare (sort /
        // "High" filter) treats the inherited copy as a different value.
        const allRules = (existing.rules || [])
            .filter((r) => r.status === CodyRulesStatus.ACTIVE)
            .map((rule) => ({
                ...rule,
                severity: rule.severity?.toLowerCase() as ICodyRule['severity'],
            }));

        const parameter = await this.parametersService.findByKey(
            ParametersKey.CODE_REVIEW_CONFIG,
            organizationAndTeamData,
        );

        const repoConfig = parameter?.configValue?.repositories?.find(
            (repo) => repo.id === repositoryId,
        );

        const directoryConfig = repoConfig?.directories?.find(
            (dir) => dir.id === directoryId,
        );

        const directoryPath = directoryConfig?.path || null;

        const rulesForPath =
            this.codyRulesValidationService.getCodyRulesForFolder(
                directoryPath,
                allRules,
                {
                    directoryId,
                    repositoryId,
                    useExclude: false,
                    useInclude: false,
                },
            );

        const rulesWithOrigins = this.setRuleOrigins(
            rulesForPath,
            repositoryId,
            directoryId,
        );

        const [globalRules, repoRules, directoryRules] = await Promise.all([
            enrichRulesWithContextReferences(
                rulesWithOrigins.globalRules,
                this.contextReferenceService,
                this.logger,
            ),
            enrichRulesWithContextReferences(
                rulesWithOrigins.repoRules,
                this.contextReferenceService,
                this.logger,
            ),
            enrichRulesWithContextReferences(
                rulesWithOrigins.directoryRules,
                this.contextReferenceService,
                this.logger,
            ),
        ]);

        return {
            globalRules,
            repoRules,
            directoryRules,
        };
    }

    private setRuleOrigins(
        rules: Partial<ICodyRule>[],
        repositoryId: string,
        directoryId?: string,
    ): {
        globalRules: Partial<CodyRuleWithInheritance>[];
        repoRules: Partial<CodyRuleWithInheritance>[];
        directoryRules: Partial<CodyRuleWithInheritance>[];
    } {
        const globalRules = [];
        const repoRules = [];
        const directoryRules = [];

        for (const rule of rules) {
            const excluded = rule.inheritance?.exclude?.includes(
                directoryId || repositoryId,
            );

            if (rule.repositoryId === 'global') {
                // it comes from global rules
                globalRules.push({
                    ...rule,
                    inherited: 'global',
                    excluded,
                });
            } else if (
                rule.repositoryId === repositoryId &&
                !rule.directoryId
            ) {
                // it comes from repository rules
                repoRules.push({
                    ...rule,
                    inherited: 'repository',
                    excluded,
                });
            } else if (
                rule.repositoryId === repositoryId &&
                rule.directoryId &&
                rule.directoryId !== directoryId
            ) {
                // it comes from another directory rules
                directoryRules.push({
                    ...rule,
                    inherited: 'directory',
                    excluded,
                });
            }
        }

        return {
            globalRules,
            repoRules,
            directoryRules,
        };
    }
}
