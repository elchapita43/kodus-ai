import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';

import { IAIAnalysisService } from '@libs/code-review/domain/contracts/AIAnalysisService.contract';

import { LLM_ANALYSIS_SERVICE_TOKEN } from '@libs/code-review/infrastructure/adapters/services/llmAnalysis.service';
import {
    AIAnalysisResult,
    AnalysisContext,
    FileChangeContext,
    ReviewModeResponse,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

import { CODY_RULES_ANALYSIS_SERVICE_TOKEN } from './codyRulesAnalysis.service';

@Injectable()
export class CodeAnalysisOrchestrator {
    private readonly logger = createLogger(CodeAnalysisOrchestrator.name);
    constructor(
        @Inject(LLM_ANALYSIS_SERVICE_TOKEN)
        private readonly standardLLMAnalysisService: IAIAnalysisService,
        @Inject(CODY_RULES_ANALYSIS_SERVICE_TOKEN)
        private readonly codyRulesAnalysisService: IAIAnalysisService,
    ) {}

    async executeStandardAnalysis(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        fileContext: FileChangeContext,
        reviewModeResponse: ReviewModeResponse,
        context: AnalysisContext,
    ): Promise<AIAnalysisResult | null> {
        try {
            const result =
                await this.standardLLMAnalysisService.analyzeCodeWithAI_v2(
                    organizationAndTeamData,
                    prNumber,
                    fileContext,
                    reviewModeResponse,
                    context,
                    context.codeReviewConfig?.byokConfig,
                );

            if (!result) {
                this.logger.log({
                    message: `Standard suggestions null for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                    context: CodeAnalysisOrchestrator.name,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                        fileContext,
                    },
                });
            }

            if (result?.codeSuggestions?.length === 0) {
                this.logger.log({
                    message: `Standard suggestions empty for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                    context: CodeAnalysisOrchestrator.name,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                        fileContext,
                    },
                });
            }

            return result;
        } catch (error) {
            this.logger.error({
                message: `Error executing standard analysis for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                context: CodeAnalysisOrchestrator.name,
                error: error,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    fileContext,
                    error,
                },
            });
            throw error;
        }
    }

    async executeCodyRulesAnalysis(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        fileContext: FileChangeContext,
        context: AnalysisContext,
        standardSuggestions: AIAnalysisResult | null,
    ): Promise<AIAnalysisResult | null> {
        try {
            if (
                !this.shouldExecuteCodyRules(
                    context,
                    organizationAndTeamData,
                    prNumber,
                )
            ) {
                return null;
            }

            const result =
                await this.codyRulesAnalysisService.analyzeCodeWithAI(
                    organizationAndTeamData,
                    prNumber,
                    fileContext,
                    ReviewModeResponse.HEAVY_MODE,
                    context,
                    standardSuggestions,
                );

            if (!result) {
                this.logger.log({
                    message: `Cody rules suggestions null for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                    context: CodeAnalysisOrchestrator.name,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                        fileContext,
                    },
                });
            }

            if (result?.codeSuggestions?.length === 0) {
                this.logger.log({
                    message: `Cody rules suggestions empty for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                    context: CodeAnalysisOrchestrator.name,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                        fileContext,
                    },
                });
            }

            return result;
        } catch (error) {
            this.logger.error({
                message: `Error executing Cody rules analysis for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                context: CodeAnalysisOrchestrator.name,
                error: error,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    fileContext,
                    error,
                },
            });
            return null;
        }
    }

    private shouldExecuteCodyRules(
        context: AnalysisContext,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
    ): boolean {
        const hasRules = context.codeReviewConfig?.codyRules?.length > 0;

        if (!hasRules) {
            this.logger.log({
                message: `Cody rules will not execute: ${!hasRules ? 'No rules found' : 'Feature disabled'} for PR#${prNumber}`,
                context: CodeAnalysisOrchestrator.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    hasRules,
                    rulesCount:
                        context.codeReviewConfig?.codyRules?.length || 0,
                    reviewOptions: context.codeReviewConfig?.reviewOptions,
                },
            });
        }

        return hasRules;
    }
}
