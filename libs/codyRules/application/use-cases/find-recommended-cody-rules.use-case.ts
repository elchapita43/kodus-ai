import { createLogger } from '@libs/core/log/logger';
import { IntegrationConfigKey } from '@libs/core/domain/enums/Integration-config-key.enum';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { LibraryCodyRule } from '@libs/core/infrastructure/config/types/general/codyRules.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/integrationConfigs/contracts/integration-config.service.contracts';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class FindRecommendedCodyRulesUseCase implements IUseCase {
    private readonly logger = createLogger(
        FindRecommendedCodyRulesUseCase.name,
    );

    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,

        @Inject(INTEGRATION_CONFIG_SERVICE_TOKEN)
        private readonly integrationConfigService: IIntegrationConfigService,
    ) {}

    async execute(
        organizationAndTeamData: OrganizationAndTeamData,
        limit: number = 10,
    ): Promise<LibraryCodyRule[]> {
        try {
            let repositories: any[] = [];
            try {
                repositories =
                    await this.integrationConfigService.findIntegrationConfigFormatted<
                        any[]
                    >(
                        IntegrationConfigKey.REPOSITORIES,
                        organizationAndTeamData,
                    );
            } catch (error) {
                this.logger.warn({
                    message: 'Failed to fetch repositories for recommendations',
                    context: FindRecommendedCodyRulesUseCase.name,
                    error,
                });
            }

            if (!Array.isArray(repositories)) {
                repositories = [];
            }

            const selectedRepos = repositories.filter((repo) => repo.selected);

            const suggestionRulesPromises = selectedRepos.map((repo) =>
                this.codyRulesService
                    .getRecommendedRulesBySuggestions(
                        organizationAndTeamData,
                        repo.id,
                        repo.language || '',
                    )
                    .catch((error) => {
                        this.logger.warn({
                            message: 'Failed to get suggestions for repository',
                            context: FindRecommendedCodyRulesUseCase.name,
                            error,
                            metadata: { repositoryId: repo.id },
                        });
                        return [];
                    }),
            );

            const allSuggestionRules = await Promise.all(
                suggestionRulesPromises,
            );
            const flattenedSuggestionRules = allSuggestionRules.flat();

            const combinedRules = [...flattenedSuggestionRules];

            const uniqueRulesMap = new Map<string, LibraryCodyRule>();
            combinedRules.forEach((rule) => {
                if (!uniqueRulesMap.has(rule.uuid)) {
                    uniqueRulesMap.set(rule.uuid, rule);
                }
            });

            const uniqueRules = Array.from(uniqueRulesMap.values());

            const limitedRules = uniqueRules.slice(0, limit);

            this.logger.log({
                message: 'Successfully retrieved recommended Cody Rules',
                context: FindRecommendedCodyRulesUseCase.name,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                    repositoriesAnalyzed: selectedRepos.length,
                    suggestionRulesCount: flattenedSuggestionRules.length,
                    totalUniqueRules: uniqueRules.length,
                    returnedRules: limitedRules.length,
                },
            });

            return limitedRules;
        } catch (error) {
            this.logger.error({
                message: 'Error finding recommended Cody Rules',
                context: FindRecommendedCodyRulesUseCase.name,
                error: error,
                metadata: {
                    organizationId: organizationAndTeamData.organizationId,
                },
            });
            throw error;
        }
    }
}
