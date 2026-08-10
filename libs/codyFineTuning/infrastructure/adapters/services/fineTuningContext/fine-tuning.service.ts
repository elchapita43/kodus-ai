import { createLogger } from '@libs/core/log/logger';
/**
 * @license
 * Codus Tech. All rights reserved.
 */

import { Injectable } from '@nestjs/common';

import { ICodyFineTuningContextPreparationService } from '@libs/core/domain/interfaces/cody-fine-tuning-context-preparation.interface';
import { CodeSuggestion } from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { CodyFineTuningService } from '../codyFineTuning.service';
import { IClusterizedSuggestion } from '@libs/codyFineTuning/domain/interfaces/codyFineTuning.interface';
/**
 * Enterprise implementation of fine tuning service
 * Extends the base class and adds advanced functionality
 * Available only in the cloud version or with an enterprise license
 */
@Injectable()
export class CodyFineTuningContextPreparationService implements ICodyFineTuningContextPreparationService {
    private readonly logger = createLogger(
        CodyFineTuningContextPreparationService.name,
    );
    constructor(
        private readonly codyFineTuningService: CodyFineTuningService,
    ) {}

    prepareCodyFineTuningContext(
        organizationId: string,
        prNumber: number,
        repository: { id: string; full_name: string },
        suggestionsToAnalyze: CodeSuggestion[],
        isFineTuningEnabled: boolean,
        clusterizedSuggestions: IClusterizedSuggestion[],
    ): Promise<{
        keepedSuggestions: Partial<CodeSuggestion>[];
        discardedSuggestions: Partial<CodeSuggestion>[];
    }> {
        return this.prepareCodyFineTuningContextInternal(
            organizationId,
            prNumber,
            repository,
            suggestionsToAnalyze,
            isFineTuningEnabled,
            clusterizedSuggestions,
        );
    }

    /**
     * Performs advanced fine tuning analysis
     * @param organizationId Organization identifier
     * @param prNumber Pull Request number
     * @param repository Repository information
     * @param suggestionsToAnalyze Suggestions to be analyzed
     * @param clusterizedSuggestions Clusterized suggestions
     * @param isFineTuningEnabled Whether fine tuning is enabled
     * @returns Array of analyzed suggestions
     * @override
     */
    async prepareCodyFineTuningContextInternal(
        organizationId: string,
        prNumber: number,
        repository: {
            id: string;
            full_name: string;
        },
        suggestionsToAnalyze: CodeSuggestion[],
        isFineTuningEnabled: boolean,
        mainClusterizedSuggestions: IClusterizedSuggestion[],
    ): Promise<{
        keepedSuggestions: Partial<CodeSuggestion>[];
        discardedSuggestions: Partial<CodeSuggestion>[];
    }> {
        if (!suggestionsToAnalyze || suggestionsToAnalyze.length === 0) {
            return {
                keepedSuggestions: [],
                discardedSuggestions: [],
            };
        }

        if (!isFineTuningEnabled) {
            return {
                keepedSuggestions: suggestionsToAnalyze,
                discardedSuggestions: [],
            };
        }

        // Verifica se há clusterizedSuggestions
        if (
            !mainClusterizedSuggestions ||
            mainClusterizedSuggestions.length === 0
        ) {
            return {
                keepedSuggestions: suggestionsToAnalyze,
                discardedSuggestions: [],
            };
        }

        try {
            const result = await this.codyFineTuningService.fineTuningAnalysis(
                organizationId,
                prNumber,
                {
                    id: repository.id,
                    full_name: repository.full_name,
                    language: suggestionsToAnalyze[0]?.language,
                },
                suggestionsToAnalyze,
                mainClusterizedSuggestions,
            );

            return {
                keepedSuggestions: result?.keepedSuggestions?.map(
                    (suggestion) => {
                        const { suggestionEmbed, ...rest } = suggestion as any;

                        return rest;
                    },
                ),
                discardedSuggestions: result?.discardedSuggestions?.map(
                    (suggestion) => {
                        const { suggestionEmbed, ...rest } = suggestion as any;

                        return rest;
                    },
                ),
            };
        } catch (error) {
            this.logger.error({
                message: 'Error performing fine tuning analysis',
                error,
                context: CodyFineTuningContextPreparationService.name,
                metadata: {
                    organizationId,
                    prNumber,
                    repository: {
                        id: repository.id,
                        full_name: repository.full_name,
                    },
                },
            });
            return {
                keepedSuggestions: suggestionsToAnalyze,
                discardedSuggestions: [],
            };
        }
    }
}
