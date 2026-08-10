import { createLogger } from '@libs/core/log/logger';
import {
    BYOKConfig,
    LLMModelProvider,
    ParserType,
    PromptRole,
    PromptRunnerService,
    TokenUsage,
} from '@codus/codus-common/llm';
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { ICodyRulesAnalysisService } from '@libs/code-review/domain/contracts/CodyRulesAnalysisService.contract';
import { buildCodyRuleLink } from '@libs/code-review/utils/build-cody-rule-link';
import { LabelType } from '@libs/common/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/common/utils/enums/severityLevel.enum';
import {
    CodyRulesPrLevelPayload,
    prompt_codyrules_prlevel_analyzer,
    prompt_codyrules_prlevel_group_rules,
} from '@libs/common/utils/langchainCommon/prompts/codyRulesPrLevel';
import { tryParseJSONObject } from '@libs/common/utils/transforms/json';
import {
    AIAnalysisResult,
    AIAnalysisResultPrLevel,
    AnalysisContext,
    FileChange,
    FileChangeContext,
    ReviewModeResponse,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { TokenChunkingService } from '@libs/core/infrastructure/services/tokenChunking/tokenChunking.service';
import { BYOKPromptRunnerService } from '@libs/core/infrastructure/services/tokenTracking/byokPromptRunner.service';
import { ObservabilityService } from '@libs/core/log/observability.service';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    ICodyRule,
    CodyRulesScope,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { ExternalReferenceLoaderService } from '@libs/codyRules/infrastructure/adapters/services/externalReferenceLoader.service';
import { DeliveryStatus } from '@libs/platformData/domain/pullRequests/enums/deliveryStatus.enum';
import { ISuggestionByPR } from '@libs/platformData/domain/pullRequests/interfaces/pullRequests.interface';

//#region Interfaces
// Interface for analyzer response
interface AnalyzerViolation {
    violatedFileSha: string[] | null;
    relatedFileIds: string[];
    reason: string;
}

// Interface for violations with suggestions already generated
interface ViolationWithSuggestion {
    violatedFileSha: string[] | null;
    relatedFileSha: string[];
    suggestionContent: string;
    oneSentenceSummary: string;
}

interface AnalyzerRuleResult {
    ruleId: string;
    violations: AnalyzerViolation[];
}

// Extended rule interface for processing
interface ExtendedCodyRule extends Partial<ICodyRule> {
    violations?: AnalyzerViolation[];
}

// Extended rule interface for rules with suggestions already generated
interface ExtendedCodyRuleWithSuggestions extends Partial<ICodyRule> {
    violations?: ViolationWithSuggestion[];
}

interface BatchProcessingConfig {
    maxConcurrentChunks: number;
    batchDelay: number; // milliseconds between batches
    retryAttempts: number;
    retryDelay: number; // milliseconds
}

interface ChunkProcessingResult {
    chunkIndex: number;
    result: ExtendedCodyRule[] | null;
    error?: Error;
    tokenUsage?: TokenUsage[];
}
//#endregion

export const CODY_RULES_PR_LEVEL_ANALYSIS_SERVICE_TOKEN = Symbol(
    'CodyRulesPrLevelAnalysisService',
);

@Injectable()
export class CodyRulesPrLevelAnalysisService implements ICodyRulesAnalysisService {
    private readonly logger = createLogger(
        CodyRulesPrLevelAnalysisService.name,
    );
    private readonly DEFAULT_USAGE_LLM_MODEL_PERCENTAGE = 90;

    private readonly DEFAULT_BATCH_CONFIG: BatchProcessingConfig = {
        maxConcurrentChunks: 10, // Process 10 chunks simultaneously by default
        batchDelay: 2000, // Time delay between batches
        retryAttempts: 3,
        retryDelay: 1000, // Time delay between retry attempts
    };

    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
        private readonly tokenChunkingService: TokenChunkingService,
        private readonly promptRunnerService: PromptRunnerService,
        private readonly observabilityService: ObservabilityService,
        private readonly externalReferenceLoaderService: ExternalReferenceLoaderService,
    ) {}

    async analyzeCodeWithAI(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        fileContext: FileChangeContext | FileChange[],
        reviewModeResponse: ReviewModeResponse,
        context: AnalysisContext,
        _suggestions?: AIAnalysisResult,
    ): Promise<AIAnalysisResultPrLevel> {
        // Safety validations
        if (!context?.codeReviewConfig) {
            this.logger.error({
                message: 'Missing codeReviewConfig in context',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: { organizationAndTeamData, prNumber },
            });
            return { codeSuggestions: [] };
        }

        if (
            !context.codeReviewConfig.codyRules ||
            !Array.isArray(context.codeReviewConfig.codyRules)
        ) {
            this.logger.warn({
                message: 'No codyRules found in config',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: { organizationAndTeamData, prNumber },
            });
            return { codeSuggestions: [] };
        }

        const changedFiles = (context as any).changedFiles as FileChange[];

        if (
            !changedFiles ||
            !Array.isArray(changedFiles) ||
            changedFiles.length === 0
        ) {
            this.logger.warn({
                message: 'No changed files found in context',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: { organizationAndTeamData, prNumber },
            });
            return { codeSuggestions: [] };
        }

        const codyRules = context.codeReviewConfig.codyRules;
        const language =
            context.codeReviewConfig.languageResultPrompt || 'en-US';

        const codyRulesPrLevel = codyRules.filter(
            (rule) => rule?.scope === CodyRulesScope.PULL_REQUEST,
        );

        if (!codyRulesPrLevel.length) {
            this.logger.log({
                message: `No PR-level rules found for PR#${prNumber}`,
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    totalRules: codyRules.length,
                },
            });
            return { codeSuggestions: [] };
        }

        let filteredCodyRules: Array<Partial<ICodyRule>>;

        // Safe check for suggestionControl
        const suggestionControl = context.codeReviewConfig?.suggestionControl;
        const applyFiltersToCodyRules =
            suggestionControl?.applyFiltersToCodyRules;

        if (applyFiltersToCodyRules) {
            const minimalSeverityLevel = suggestionControl?.severityLevelFilter;

            filteredCodyRules = await this.filterRulesByMinimumSeverity(
                codyRulesPrLevel,
                minimalSeverityLevel,
            );

            if (!filteredCodyRules.length) {
                this.logger.log({
                    message: `No PR-level rules found after severity filtering for PR#${prNumber}`,
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                        totalRulesBeforeFilter: codyRulesPrLevel.length,
                        minimalSeverityLevel,
                    },
                });
                return {
                    codeSuggestions: [],
                };
            }
        } else {
            filteredCodyRules = codyRulesPrLevel;
        }

        const { referencesMap: externalReferencesMap } =
            await this.externalReferenceLoaderService.loadReferencesForRules(
                filteredCodyRules,
                context,
            );

        const rulesWithLoadedReferences = filteredCodyRules.filter((rule) => {
            const fullRule = rule as Partial<ICodyRule>;
            if (!fullRule.contextReferenceId) {
                return true;
            }

            if (fullRule.uuid) {
                const hasKnowledge = externalReferencesMap.has(fullRule.uuid);

                if (hasKnowledge) {
                    return true;
                }
            }

            this.logger.warn({
                message:
                    'Skipping PR-level rule with contextReferenceId that failed to load references or MCP dependencies',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    ruleUuid: fullRule.uuid,
                    ruleTitle: fullRule.title,
                    contextReferenceId: fullRule.contextReferenceId,
                    organizationAndTeamData,
                },
            });
            return false;
        });

        if (rulesWithLoadedReferences.length === 0) {
            this.logger.log({
                message: `No PR-level rules with external context (knowledge or MCP) for PR#${prNumber}`,
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                },
            });
            return { codeSuggestions: [] };
        }

        const provider = LLMModelProvider.GEMINI_2_5_PRO;

        try {
            return await this.processWithTokenChunking(
                organizationAndTeamData,
                prNumber,
                context,
                changedFiles,
                rulesWithLoadedReferences,
                language,
                provider,
                externalReferencesMap,
            );
        } catch (error) {
            this.logger.error({
                message: `Error during PR-level Cody Rules analysis for PR#${prNumber}`,
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                },
                error,
            });
            throw error;
        }
    }

    private processLLMResponse(response: string): any {
        try {
            if (!response) {
                return null;
            }

            let cleanResponse = response;
            if (response?.startsWith('```')) {
                cleanResponse = response
                    .replace(/^```json\n/, '')
                    .replace(/\n```(\n)?$/, '')
                    .trim();
            }

            const parsedResponse: AnalyzerRuleResult[] =
                tryParseJSONObject(cleanResponse);

            return parsedResponse;
        } catch (error) {
            this.logger.error({
                message: 'Error processing LLM response',
                error,
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    response,
                },
            });
            return null;
        }
    }

    private processAnalyzerResponse(
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        response: string,
        files: FileChange[],
        prNumber: number,
        organizationAndTeamData: OrganizationAndTeamData,
    ): ExtendedCodyRule[] | null {
        try {
            if (!response) {
                this.logger.warn({
                    message: 'Empty response from LLM analyzer',
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        prNumber,
                        organizationAndTeamData,
                        filesCount: files.length,
                    },
                });
                return null;
            }

            const parse = this.processLLMResponse(response);
            const parsedResponse = Array.isArray(parse) ? parse : [parse];

            if (!parsedResponse) {
                this.logger.warn({
                    message:
                        'Failed to parse LLM response - continuing without violations',
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        prNumber,
                        organizationAndTeamData,
                        responseLength: response.length,
                    },
                });
                return null;
            }

            if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
                this.logger.log({
                    message: 'No violations found in LLM response',
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        prNumber,
                        organizationAndTeamData,
                        responseType: typeof parsedResponse,
                        isArray: Array.isArray(parsedResponse),
                    },
                });
                return null;
            }

            // Map violations to rules
            const violatedRules: ExtendedCodyRule[] = [];

            for (const ruleResult of parsedResponse) {
                if (!ruleResult?.ruleId) {
                    this.logger.warn({
                        message: 'Rule result missing ruleId, skipping',
                        context: CodyRulesPrLevelAnalysisService.name,
                        metadata: {
                            ruleResult,
                            prNumber,
                            organizationAndTeamData,
                        },
                    });
                    continue;
                }

                const rule = codyRulesPrLevel.find(
                    (r) => r.uuid === ruleResult.ruleId,
                );

                if (!rule) {
                    this.logger.warn({
                        message: 'Rule not found for ruleId, skipping',
                        context: CodyRulesPrLevelAnalysisService.name,
                        metadata: {
                            ruleId: ruleResult.ruleId,
                            prNumber,
                            organizationAndTeamData,
                        },
                    });
                    continue;
                }

                if (
                    !ruleResult.violations ||
                    !Array.isArray(ruleResult.violations)
                ) {
                    this.logger.warn({
                        message: 'Invalid violations format for rule, skipping',
                        context: CodyRulesPrLevelAnalysisService.name,
                        metadata: {
                            ruleId: ruleResult.ruleId,
                            violationsType: typeof ruleResult.violations,
                            prNumber,
                            organizationAndTeamData,
                        },
                    });
                    continue;
                }

                violatedRules.push({
                    ...rule,
                    violations: ruleResult.violations,
                });
            }

            this.logger.log({
                message: 'Successfully processed analyzer response',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    totalRulesInResponse: parsedResponse.length,
                    totalViolatedRules: violatedRules.length,
                    prNumber,
                    organizationAndTeamData,
                },
            });

            return violatedRules?.length > 0 ? violatedRules : null;
        } catch (error) {
            this.logger.error({
                message: 'Error processing analyzer response',
                context: CodyRulesPrLevelAnalysisService.name,
                error,
                metadata: {
                    prNumber,
                    organizationAndTeamData,
                    responseLength: response?.length || 0,
                },
            });
            return null;
        }
    }
    //#endregion

    //#region Replace Cody Rule IDs with Links
    private async replaceCodyRuleIdsWithLinks(
        suggestions: AIAnalysisResultPrLevel,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
    ): Promise<AIAnalysisResultPrLevel> {
        if (!suggestions?.codeSuggestions?.length) {
            return suggestions;
        }

        const updatedSuggestions = await Promise.all(
            suggestions.codeSuggestions.map(async (suggestion) => {
                try {
                    if (suggestion?.label === LabelType.CODY_RULES) {
                        const updatedContent =
                            suggestion?.suggestionContent || '';

                        const uuidRegex =
                            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
                        const foundIds: string[] =
                            updatedContent.match(uuidRegex) || [];

                        const updatedContentWithLinks =
                            await this.buildCodyRuleLinkAndRepalceIds(
                                foundIds,
                                updatedContent,
                                organizationAndTeamData,
                                prNumber,
                            );

                        return {
                            ...suggestion,
                            suggestionContent: updatedContentWithLinks,
                        };
                    }

                    return suggestion;
                } catch (error) {
                    this.logger.error({
                        message:
                            'Error processing suggestion for Cody Rule links',
                        context: CodyRulesPrLevelAnalysisService.name,
                        error,
                        metadata: {
                            suggestionId: suggestion.id,
                            organizationAndTeamData,
                            prNumber,
                        },
                    });
                    return suggestion;
                }
            }),
        );

        return {
            ...suggestions,
            codeSuggestions: updatedSuggestions,
        };
    }

    private async buildCodyRuleLinkAndRepalceIds(
        foundIds: string[],
        updatedContent: string,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
    ): Promise<string> {
        // Processar todos os IDs encontrados
        for (const ruleId of foundIds) {
            try {
                const rule = await this.codyRulesService.findById(ruleId);

                if (!rule) {
                    continue;
                }

                const baseUrl = process.env.API_USER_INVITE_BASE_URL || '';
                const ruleLink = buildCodyRuleLink(
                    baseUrl,
                    ruleId,
                    rule,
                    organizationAndTeamData,
                );

                const escapeMarkdownSyntax = (text: string): string =>
                    text.replace(/([[\]\\`*_{}()#+\-.!])/g, '\\$1');
                const markdownLink = `[${escapeMarkdownSyntax(rule.title)}](${ruleLink})`;

                // Verificar se o ID está entre crases simples `id`
                const singleBacktickPattern = new RegExp(
                    `\`${this.escapeRegex(ruleId)}\``,
                    'g',
                );
                if (singleBacktickPattern.test(updatedContent)) {
                    updatedContent = updatedContent.replace(
                        singleBacktickPattern,
                        markdownLink,
                    );
                    continue;
                }

                const tripleBacktickPattern = new RegExp(
                    `\`\`\`${this.escapeRegex(ruleId)}\`\`\``,
                    'g',
                );
                if (tripleBacktickPattern.test(updatedContent)) {
                    updatedContent = updatedContent.replace(
                        tripleBacktickPattern,
                        markdownLink,
                    );
                    continue;
                }

                const idPattern = new RegExp(this.escapeRegex(ruleId), 'g');
                updatedContent = updatedContent.replace(
                    idPattern,
                    markdownLink,
                );
            } catch (error) {
                this.logger.error({
                    message: 'Error fetching Cody Rule details',
                    context: CodyRulesPrLevelAnalysisService.name,
                    error: error,
                    metadata: {
                        ruleId,
                        organizationAndTeamData,
                        prNumber,
                    },
                });
                continue;
            }
        }

        return updatedContent;
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    //#endregion

    //#region Token Chunking with Parallel Processing
    private async processWithTokenChunking(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        context: AnalysisContext,
        changedFiles: FileChange[],
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        language: string,
        provider: LLMModelProvider,
        externalReferencesMap?: Map<string, any[]>,
    ): Promise<AIAnalysisResultPrLevel> {
        const preparedFiles = this.prepareFilesForPayload(changedFiles);

        const byokMaxInputTokens =
            context?.codeReviewConfig?.byokConfig?.main?.maxInputTokens;

        const chunkingResult = this.tokenChunkingService.chunkDataByTokens({
            model: provider,
            data: preparedFiles,
            usagePercentage: this.DEFAULT_USAGE_LLM_MODEL_PERCENTAGE,
            ...(byokMaxInputTokens && byokMaxInputTokens > 0
                ? { overrideMaxTokens: byokMaxInputTokens }
                : {}),
        });

        this.logger.log({
            message: `PR divided into ${chunkingResult.totalChunks} chunks`,
            context: CodyRulesPrLevelAnalysisService.name,
            metadata: {
                totalFiles: preparedFiles.length,
                totalChunks: chunkingResult.totalChunks,
                tokenLimit: chunkingResult.tokenLimit,
                tokensPerChunk: chunkingResult.tokensPerChunk,
                prNumber,
                organizationAndTeamData,
            },
        });

        const batchConfig = this.determineBatchConfig(
            chunkingResult.totalChunks,
        );

        const byokMaxConcurrent =
            context?.codeReviewConfig?.byokConfig?.main?.maxConcurrentRequests;
        if (byokMaxConcurrent && byokMaxConcurrent > 0) {
            batchConfig.maxConcurrentChunks = Math.min(
                batchConfig.maxConcurrentChunks,
                byokMaxConcurrent,
            );
        }

        this.logger.log({
            message: `Batch configuration determined`,
            context: CodyRulesPrLevelAnalysisService.name,
            metadata: {
                totalChunks: chunkingResult.totalChunks,
                maxConcurrentChunks: batchConfig.maxConcurrentChunks,
                batchDelay: batchConfig.batchDelay,
                prNumber,
            },
        });

        const allViolatedRules = await this.processChunksInBatches(
            chunkingResult.chunks,
            context,
            codyRulesPrLevel,
            language,
            provider,
            prNumber,
            organizationAndTeamData,
            batchConfig,
            externalReferencesMap,
        );

        this.logger.log({
            message: `Parallel chunk processing completed`,
            context: CodyRulesPrLevelAnalysisService.name,
            metadata: {
                totalChunks: chunkingResult.totalChunks,
                violationsFound: allViolatedRules.length,
                prNumber,
                organizationAndTeamData,
            },
        });

        // 5. Combine results from all chunks
        return this.combineChunkResults(
            allViolatedRules,
            codyRulesPrLevel,
            organizationAndTeamData,
            prNumber,
            language,
            context?.codeReviewConfig?.byokConfig,
        );
    }

    /**
     * Determines batch configuration based on total number of chunks
     */
    private determineBatchConfig(totalChunks: number): BatchProcessingConfig {
        const baseConfig = { ...this.DEFAULT_BATCH_CONFIG };

        if (totalChunks <= 10) {
            baseConfig.maxConcurrentChunks = totalChunks;
            baseConfig.batchDelay = 0;
        } else if (totalChunks <= 50) {
            baseConfig.maxConcurrentChunks = 7;
            baseConfig.batchDelay = 2000;
        } else {
            baseConfig.maxConcurrentChunks = 5;
            baseConfig.batchDelay = 3000;
        }

        return baseConfig;
    }

    /**
     * Processes chunks in parallel batches
     */
    private async processChunksInBatches(
        chunks: FileChange[][],
        context: AnalysisContext,
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        language: string,
        provider: LLMModelProvider,
        prNumber: number,
        organizationAndTeamData: OrganizationAndTeamData,
        batchConfig: BatchProcessingConfig,
        externalReferencesMap?: Map<string, any[]>,
    ): Promise<ExtendedCodyRule[]> {
        const allViolatedRules: ExtendedCodyRule[] = [];
        let failedChunks = 0;
        let firstChunkError: Error | undefined;
        const totalChunks = chunks.length;
        const { maxConcurrentChunks, batchDelay } = batchConfig;

        // Process chunks in batches
        for (let i = 0; i < totalChunks; i += maxConcurrentChunks) {
            const batchNumber = Math.floor(i / maxConcurrentChunks) + 1;
            const totalBatches = Math.ceil(totalChunks / maxConcurrentChunks);
            const batchChunks = chunks.slice(i, i + maxConcurrentChunks);

            this.logger.log({
                message: `Processing batch ${batchNumber}/${totalBatches}`,
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    batchNumber,
                    totalBatches,
                    chunksInBatch: batchChunks.length,
                    chunkIndexes: batchChunks.map((_, idx) => i + idx),
                    prNumber,
                },
            });

            // Process current batch in parallel
            const batchResults = await this.processBatchInParallel(
                batchChunks,
                i, // offset for chunk indexing
                context,
                codyRulesPrLevel,
                language,
                provider,
                prNumber,
                organizationAndTeamData,
                batchConfig,
                externalReferencesMap,
            );

            // Consolidate batch results
            batchResults.forEach(({ result, error, chunkIndex }) => {
                if (error) {
                    failedChunks++;
                    if (!firstChunkError) {
                        firstChunkError = error;
                    }
                    this.logger.error({
                        message: `Error in batch ${batchNumber}, chunk ${chunkIndex}`,
                        context: CodyRulesPrLevelAnalysisService.name,
                        error,
                        metadata: {
                            batchNumber,
                            chunkIndex,
                            prNumber,
                            organizationAndTeamData,
                        },
                    });
                } else if (result?.length) {
                    allViolatedRules.push(...result);
                }
            });

            // Batch delay (except for the last one)
            if (i + maxConcurrentChunks < totalChunks && batchDelay > 0) {
                this.logger.log({
                    message: `Waiting ${batchDelay}ms before next batch`,
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: { batchDelay, nextBatch: batchNumber + 1 },
                });
                await this.delay(batchDelay);
            }
        }

        if (allViolatedRules.length === 0 && failedChunks > 0) {
            const errorMessage = firstChunkError?.message || 'Unknown error';
            throw new Error(
                `PR-level Cody Rules analysis failed in ${failedChunks}/${totalChunks} chunks: ${errorMessage}`,
            );
        }

        return allViolatedRules;
    }

    /**
     * Processes a batch of chunks in parallel
     */
    private async processBatchInParallel(
        batchChunks: FileChange[][],
        indexOffset: number,
        context: AnalysisContext,
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        language: string,
        provider: LLMModelProvider,
        prNumber: number,
        organizationAndTeamData: OrganizationAndTeamData,
        batchConfig: BatchProcessingConfig,
        externalReferencesMap?: Map<string, any[]>,
    ): Promise<ChunkProcessingResult[]> {
        // Create promises to process chunks in parallel
        const chunkPromises = batchChunks.map(async (chunk, batchIndex) => {
            const chunkIndex = indexOffset + batchIndex;

            return this.processChunkWithRetry(
                chunk,
                chunkIndex,
                context,
                codyRulesPrLevel,
                language,
                provider,
                prNumber,
                organizationAndTeamData,
                batchConfig,
                externalReferencesMap,
            );
        });

        // Wait for all chunks in the batch
        return Promise.all(chunkPromises);
    }

    /**
     * Processes an individual chunk with retry logic
     */
    private async processChunkWithRetry(
        chunk: FileChange[],
        chunkIndex: number,
        context: AnalysisContext,
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        language: string,
        provider: LLMModelProvider,
        prNumber: number,
        organizationAndTeamData: OrganizationAndTeamData,
        batchConfig: BatchProcessingConfig,
        externalReferencesMap?: Map<string, any[]>,
    ): Promise<ChunkProcessingResult> {
        const { retryAttempts, retryDelay } = batchConfig;

        // Limit max delay to avoid very long timeouts
        const MAX_RETRY_DELAY = 10000; // 10 seconds maximum

        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            try {
                this.logger.log({
                    message: `Processing chunk ${chunkIndex + 1} (attempt ${attempt})`,
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        chunkIndex,
                        attempt,
                        filesInChunk: chunk.length,
                        prNumber,
                        organizationAndTeamData,
                    },
                });

                const result = await this.processChunk(
                    context,
                    chunk,
                    codyRulesPrLevel,
                    language,
                    provider,
                    chunkIndex,
                    prNumber,
                    organizationAndTeamData,
                    externalReferencesMap,
                );

                return {
                    chunkIndex,
                    result,
                };
            } catch (error) {
                this.logger.warn({
                    message: `Error processing chunk ${chunkIndex + 1}, attempt ${attempt}`,
                    context: CodyRulesPrLevelAnalysisService.name,
                    error,
                    metadata: {
                        chunkIndex,
                        attempt,
                        prNumber,
                        organizationAndTeamData,
                    },
                });

                // If not the last attempt, wait before trying again
                if (attempt < retryAttempts) {
                    // Use limited linear delay instead of exponential to avoid very long timeouts
                    const delayMs = Math.min(
                        retryDelay * attempt,
                        MAX_RETRY_DELAY,
                    );
                    this.logger.log({
                        message: `Waiting ${delayMs}ms before retry ${attempt + 1}`,
                        context: CodyRulesPrLevelAnalysisService.name,
                        metadata: { chunkIndex, attempt, delayMs },
                    });
                    await this.delay(delayMs);
                } else {
                    // Last attempt failed - log detailed error
                    this.logger.error({
                        message: `Chunk ${chunkIndex + 1} failed after ${retryAttempts} attempts`,
                        context: CodyRulesPrLevelAnalysisService.name,
                        error,
                        metadata: {
                            chunkIndex,
                            totalAttempts: retryAttempts,
                            prNumber,
                            organizationAndTeamData,
                            filesInChunk: chunk.length,
                        },
                    });

                    return {
                        chunkIndex,
                        result: null,
                        error: error as Error,
                    };
                }
            }
        }

        // Never should reach here, but TypeScript needs it
        return {
            chunkIndex,
            result: null,
            error: new Error('Unexpected error in retry logic'),
        };
    }

    /**
     * Utility for delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private prepareFilesForPayload(changedFiles: FileChange[]): FileChange[] {
        return changedFiles.map((file) => ({
            ...file,
            fileContent: undefined,
        }));
    }

    private async processChunk(
        context: AnalysisContext,
        filesChunk: FileChange[],
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        language: string,
        provider: LLMModelProvider,
        chunkIndex: number,
        prNumber: number,
        organizationAndTeamData: OrganizationAndTeamData,
        externalReferencesMap?: Map<string, any[]>,
    ): Promise<ExtendedCodyRule[] | null> {
        const analyzerPayload: CodyRulesPrLevelPayload = {
            pr_title: context.pullRequest.title,
            pr_description: context.pullRequest.body || '',
            pr_author:
                context.pullRequest.user?.login ??
                context.pullRequest.user?.name,
            tags: context.pullRequest.tags,
            stats: context.pullRequest.stats ?? {
                total_additions: 0,
                total_deletions: 0,
                total_files: 0,
                total_lines_changed: 0,
            },
            files: filesChunk,
            rules: codyRulesPrLevel,
            language,
            externalReferencesMap,
            memories: context?.codeReviewConfig?.codyMemoryRules || [],
        };

        const fallbackProvider = LLMModelProvider.NOVITA_DEEPSEEK_V3;

        const promptRunner = new BYOKPromptRunnerService(
            this.promptRunnerService,
            provider,
            fallbackProvider,
            context?.codeReviewConfig?.byokConfig,
        );

        const runName = 'prLevelCodyRulesAnalyzer';
        const spanName = `${CodyRulesPrLevelAnalysisService.name}::${runName}`;
        const spanAttrs = {
            type: promptRunner.executeMode,
            organizationId: organizationAndTeamData.organizationId,
            prNumber,
            chunkIndex,
            filesCount: filesChunk.length,
            provider:
                context?.codeReviewConfig?.byokConfig?.main?.provider ??
                provider,
            fallbackProvider:
                context?.codeReviewConfig?.byokConfig?.fallback?.provider ??
                fallbackProvider,
            model: context?.codeReviewConfig?.byokConfig?.main?.model,
            fallbackModel:
                context?.codeReviewConfig?.byokConfig?.fallback?.model,
        };

        const byokConfigRef = context?.codeReviewConfig?.byokConfig;

        try {
            const { result: analysis } =
                await this.observabilityService.runLLMInSpan({
                    spanName,
                    runName,
                    attrs: spanAttrs,
                    byokConfig: byokConfigRef,
                    exec: async (callbacks) => {
                        return await promptRunner
                            .builder()
                            .setParser(ParserType.STRING)
                            .setLLMJsonMode(true)
                            .setPayload(analyzerPayload)
                            .addPrompt({
                                prompt: prompt_codyrules_prlevel_analyzer,
                                role: PromptRole.SYSTEM,
                            })
                            .addPrompt({
                                prompt: 'Please analyze the provided information and return the response in the specified format',
                                role: PromptRole.USER,
                            })
                            .addMetadata({
                                organizationAndTeamData,
                                prNumber,
                                provider:
                                    context?.codeReviewConfig?.byokConfig?.main
                                        ?.provider ?? provider,
                                fallbackProvider:
                                    context?.codeReviewConfig?.byokConfig
                                        ?.fallback?.provider ??
                                    fallbackProvider,
                                model: context?.codeReviewConfig?.byokConfig
                                    ?.main?.model,
                                fallbackModel:
                                    context?.codeReviewConfig?.byokConfig
                                        ?.fallback?.model,
                                chunkIndex,
                                runName,
                            })
                            .addTags([
                                ...this.buildTags(provider, 'primary'),
                                ...this.buildTags(fallbackProvider, 'fallback'),
                            ])
                            .addCallbacks(callbacks)
                            .setRunName(runName)
                            .setTemperature(0)
                            .execute();
                    },
                });

            if (!analysis) {
                const message = `No response from LLM for chunk ${chunkIndex + 1} for PR#${prNumber}`;
                this.logger.warn({
                    message,
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        chunkIndex,
                        prNumber,
                        organizationAndTeamData,
                        filesCount: filesChunk.length,
                    },
                });
                throw new Error(message);
            }

            // processa resposta do chunk
            return this.processAnalyzerResponse(
                codyRulesPrLevel,
                analysis,
                filesChunk,
                prNumber,
                organizationAndTeamData,
            );
        } catch (error) {
            // runLLMInSpan já marca status/exception no span; aqui só logamos e propagamos
            this.logger.error({
                message: `Error processing chunk ${chunkIndex + 1} for PR#${prNumber}`,
                context: CodyRulesPrLevelAnalysisService.name,
                error,
                metadata: {
                    chunkIndex,
                    prNumber,
                    organizationAndTeamData,
                    filesCount: filesChunk.length,
                },
            });
            throw error;
        }
    }

    private async combineChunkResults(
        allViolatedRules: ExtendedCodyRule[],
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        language: string,
        byokConfig: BYOKConfig,
    ): Promise<AIAnalysisResultPrLevel> {
        if (!allViolatedRules?.length) {
            this.logger.log({
                message: `No violations found across all chunks for PR#${prNumber}`,
                context: CodyRulesPrLevelAnalysisService.name,
            });
            return {
                codeSuggestions: [],
            };
        }

        // Deduplicate violated rules (mesmo rule pode ter violações em chunks diferentes)
        const uniqueViolatedRules =
            await this.deduplicateViolatedRules(allViolatedRules);

        this.logger.log({
            message: `Combined chunk results`,
            context: CodyRulesPrLevelAnalysisService.name,
            metadata: {
                totalViolations: allViolatedRules.length,
                uniqueViolatedRules: uniqueViolatedRules.length,
                prNumber,
                organizationAndTeamData,
            },
        });

        // Mapear para suggestions
        const suggestions = await this.mapViolatedRulesToSuggestions(
            uniqueViolatedRules as unknown as ExtendedCodyRuleWithSuggestions[],
        );

        // NOVO: Agrupar suggestions duplicadas usando LLM
        const groupedSuggestions = await this.groupDuplicateSuggestions(
            suggestions,
            codyRulesPrLevel,
            language,
            organizationAndTeamData,
            prNumber,
            byokConfig,
        );

        // Adicionar severidade
        const suggestionsWithSeverity = this.addSeverityToSuggestions(
            { codeSuggestions: groupedSuggestions },
            codyRulesPrLevel,
        );

        // Processar links
        return this.replaceCodyRuleIdsWithLinks(
            suggestionsWithSeverity,
            organizationAndTeamData,
            prNumber,
        );
    }
    //#endregion

    //#region Grouping Violated Rules
    private async deduplicateViolatedRules(
        violatedRules: ExtendedCodyRule[],
    ): Promise<ExtendedCodyRule[]> {
        const ruleMap = new Map<string, ExtendedCodyRule>();

        for (const rule of violatedRules) {
            if (!rule.uuid) continue;

            if (ruleMap.has(rule.uuid)) {
                // Merge violations
                const existingRule = ruleMap.get(rule.uuid)!;
                existingRule.violations = [
                    ...(existingRule.violations || []),
                    ...(rule.violations || []),
                ];
            } else {
                ruleMap.set(rule.uuid, rule);
            }
        }

        return Array.from(ruleMap.values());
    }

    private async groupDuplicateSuggestions(
        suggestions: ISuggestionByPR[],
        codyRulesPrLevel: Array<Partial<ICodyRule>>,
        language: string,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        byokConfig: BYOKConfig,
    ): Promise<ISuggestionByPR[]> {
        if (!suggestions?.length) {
            return suggestions;
        }

        // 1. Identificar suggestions duplicadas (mesma regra)
        const groupedByRule = this.groupSuggestionsByRule(suggestions);

        // 2. Processar apenas grupos com mais de 1 suggestion
        const duplicatedGroups = Object.entries(groupedByRule).filter(
            ([_, groupSuggestions]) => groupSuggestions.length > 1,
        );

        if (!duplicatedGroups.length) {
            this.logger.log({
                message: 'No duplicate suggestions found, skipping grouping',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: { totalSuggestions: suggestions.length, prNumber },
            });
            return suggestions;
        }

        this.logger.log({
            message: `Found ${duplicatedGroups.length} rule(s) with duplicate suggestions`,
            context: CodyRulesPrLevelAnalysisService.name,
            metadata: {
                duplicatedGroups: duplicatedGroups.length,
                totalSuggestions: suggestions.length,
                prNumber,
            },
        });

        // 3. Processar cada grupo duplicado
        const groupedSuggestions: ISuggestionByPR[] = [];

        for (const [ruleId, duplicatedSuggestions] of duplicatedGroups) {
            try {
                const rule = codyRulesPrLevel.find((r) => r.uuid === ruleId);

                if (!rule) {
                    this.logger.warn({
                        message: `Rule not found for grouping: ${ruleId}`,
                        context: CodyRulesPrLevelAnalysisService.name,
                    });
                    // Se não encontrar a regra, mantém as suggestions originais
                    groupedSuggestions.push(...duplicatedSuggestions);
                    continue;
                }

                const groupedSuggestion = await this.processRuleGrouping(
                    rule,
                    duplicatedSuggestions,
                    language,
                    organizationAndTeamData,
                    prNumber,
                    byokConfig,
                );

                groupedSuggestions.push(groupedSuggestion);
            } catch (error) {
                this.logger.error({
                    message: `Error grouping suggestions for rule ${ruleId}`,
                    context: CodyRulesPrLevelAnalysisService.name,
                    error,
                    metadata: { ruleId, prNumber, organizationAndTeamData },
                });
                // Em caso de erro, mantém as suggestions originais
                groupedSuggestions.push(...duplicatedSuggestions);
            }
        }

        // 4. Adicionar suggestions que não tinham duplicatas
        const nonDuplicatedSuggestions = suggestions.filter((suggestion) => {
            const ruleIds = suggestion.brokenCodyRulesIds || [];
            return !ruleIds.some((ruleId) =>
                duplicatedGroups.some(
                    ([groupRuleId]) => groupRuleId === ruleId,
                ),
            );
        });

        groupedSuggestions.push(...nonDuplicatedSuggestions);

        this.logger.log({
            message: `Grouping completed`,
            context: CodyRulesPrLevelAnalysisService.name,
            metadata: {
                originalSuggestions: suggestions.length,
                finalSuggestions: groupedSuggestions.length,
                groupsProcessed: duplicatedGroups.length,
                prNumber,
            },
        });

        return groupedSuggestions;
    }

    private groupSuggestionsByRule(
        suggestions: ISuggestionByPR[],
    ): Record<string, ISuggestionByPR[]> {
        const grouped: Record<string, ISuggestionByPR[]> = {};

        for (const suggestion of suggestions) {
            const ruleIds = suggestion.brokenCodyRulesIds || [];

            for (const ruleId of ruleIds) {
                if (!grouped[ruleId]) {
                    grouped[ruleId] = [];
                }
                grouped[ruleId].push(suggestion);
            }
        }

        return grouped;
    }

    private async processRuleGrouping(
        rule: Partial<ICodyRule>,
        duplicatedSuggestions: ISuggestionByPR[],
        language: string,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        byokConfig: BYOKConfig,
    ): Promise<ISuggestionByPR> {
        // Filtro rápido + fallback seguro
        if (!duplicatedSuggestions || duplicatedSuggestions.length === 0) {
            this.logger.error({
                message: 'No duplicated suggestions provided for grouping',
                context: CodyRulesPrLevelAnalysisService.name,
                metadata: {
                    ruleId: rule?.uuid,
                    prNumber,
                    organizationAndTeamData,
                },
            });
            return {
                id: uuidv4(),
                suggestionContent: 'Error processing suggestions',
                oneSentenceSummary: 'Error occurred during processing',
                label: LabelType.CODY_RULES,
                brokenCodyRulesIds: rule?.uuid ? [rule.uuid] : [],
                deliveryStatus: DeliveryStatus.NOT_SENT,
                files: { violatedFileSha: [], relatedFileSha: [] },
            };
        }

        const provider = LLMModelProvider.GEMINI_2_5_PRO;
        const fallbackProvider = LLMModelProvider.NOVITA_DEEPSEEK_V3;

        const promptRunner = new BYOKPromptRunnerService(
            this.promptRunnerService,
            provider,
            fallbackProvider,
            byokConfig,
        );

        const runName = 'prLevelCodyRulesGrouper';
        const spanName = `${CodyRulesPrLevelAnalysisService.name}::${runName}`;
        const spanAttrs = {
            type: promptRunner.executeMode,
            organizationId: organizationAndTeamData?.organizationId,
            prNumber,
            ruleId: rule?.uuid,
        };

        const groupingPayload = {
            rule: {
                title: rule?.title || '',
                description: rule?.rule || '',
            },
            language,
            violations: duplicatedSuggestions.map((s) => ({
                violatedFileSha: s.files?.violatedFileSha || [],
                relatedFileSha: s.files?.relatedFileSha || [],
                reason: s.suggestionContent || '',
            })),
        };

        try {
            const { result: grouping } =
                await this.observabilityService.runLLMInSpan({
                    spanName,
                    runName,
                    attrs: spanAttrs,
                    byokConfig,
                    exec: async (callbacks) => {
                        return await promptRunner
                            .builder()
                            .setParser(ParserType.STRING)
                            .setLLMJsonMode(true)
                            .setPayload(groupingPayload)
                            .addPrompt({
                                prompt: prompt_codyrules_prlevel_group_rules,
                                role: PromptRole.SYSTEM,
                            })
                            .addPrompt({
                                prompt: 'Please consolidate the provided violations into a single coherent comment following the instructions.',
                                role: PromptRole.USER,
                            })
                            .addMetadata({
                                organizationId:
                                    organizationAndTeamData?.organizationId,
                                teamId: organizationAndTeamData?.teamId,
                                pullRequestId: prNumber,
                                ruleId: rule?.uuid,
                                provider:
                                    byokConfig?.main?.provider || provider,
                                model: byokConfig?.main?.model,
                                fallbackProvider:
                                    byokConfig?.fallback?.provider ||
                                    fallbackProvider,
                                fallbackModel: byokConfig?.fallback?.model,
                                runName,
                            })
                            .addTags([
                                ...this.buildTags(provider, 'primary'),
                                ...this.buildTags(fallbackProvider, 'fallback'),
                            ])
                            .addCallbacks(callbacks) // captura usage por provedor
                            .setRunName(runName)
                            .setTemperature(0)
                            .execute();
                    },
                });

            if (!grouping) {
                const message = 'No response from LLM for grouping suggestions';
                this.logger.warn({
                    message,
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        ruleId: rule?.uuid,
                        prNumber,
                        organizationAndTeamData,
                    },
                });
                throw new Error(message);
            }

            const groupedContent = this.processLLMResponse(grouping);

            // Validação de segurança do resultado
            if (!groupedContent?.violations?.[0]) {
                this.logger.warn({
                    message: 'Invalid grouped content returned from LLM',
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        ruleId: rule?.uuid,
                        prNumber,
                        organizationAndTeamData,
                    },
                });

                // Usar primeira suggestion como fallback
                const baseSuggestion = duplicatedSuggestions[0];
                return {
                    id: uuidv4(),
                    suggestionContent: baseSuggestion.suggestionContent || '',
                    oneSentenceSummary: baseSuggestion.oneSentenceSummary || '',
                    label: baseSuggestion.label,
                    brokenCodyRulesIds: baseSuggestion.brokenCodyRulesIds || [],
                    deliveryStatus: baseSuggestion.deliveryStatus,
                    files: { violatedFileSha: [], relatedFileSha: [] },
                };
            }

            // Criar nova suggestion agrupada baseada na primeira suggestion
            const baseSuggestion = duplicatedSuggestions[0];
            const firstViolation = groupedContent.violations[0];

            const groupedSuggestion: ISuggestionByPR = {
                id: uuidv4(),
                suggestionContent:
                    firstViolation.suggestionContent?.trim() ||
                    baseSuggestion.suggestionContent ||
                    '',
                oneSentenceSummary:
                    firstViolation.oneSentenceSummary?.trim() ||
                    baseSuggestion.oneSentenceSummary ||
                    '',
                label: baseSuggestion.label,
                brokenCodyRulesIds: baseSuggestion.brokenCodyRulesIds || [],
                deliveryStatus: baseSuggestion.deliveryStatus,
                severity: baseSuggestion.severity,
                files: {
                    violatedFileSha: firstViolation?.violatedFileSha || [],
                    relatedFileSha: firstViolation?.relatedFileSha || [],
                },
            };

            return groupedSuggestion;
        } catch (error) {
            this.logger.error({
                message: 'Error during rule grouping',
                context: CodyRulesPrLevelAnalysisService.name,
                error,
                metadata: {
                    ruleId: rule?.uuid,
                    prNumber,
                    organizationAndTeamData,
                },
            });

            // Retornar primeira suggestion como fallback
            const baseSuggestion = duplicatedSuggestions[0];
            return {
                id: uuidv4(),
                suggestionContent: baseSuggestion.suggestionContent || '',
                oneSentenceSummary: baseSuggestion.oneSentenceSummary || '',
                label: baseSuggestion.label,
                brokenCodyRulesIds: baseSuggestion.brokenCodyRulesIds || [],
                deliveryStatus: baseSuggestion.deliveryStatus,
                severity: baseSuggestion.severity,
                files: baseSuggestion.files || {
                    violatedFileSha: [],
                    relatedFileSha: [],
                },
            };
        }
    }
    //#endregion

    //#region Severity Management
    addSeverityToSuggestions(
        suggestions: AIAnalysisResultPrLevel,
        codyRules: Array<Partial<ICodyRule>>,
    ): AIAnalysisResultPrLevel {
        if (!suggestions?.codeSuggestions?.length || !codyRules?.length) {
            return suggestions;
        }

        const updatedSuggestions = suggestions.codeSuggestions.map(
            (suggestion: ISuggestionByPR) => {
                if (!suggestion.brokenCodyRulesIds?.length) {
                    return suggestion;
                }

                const severities = suggestion.brokenCodyRulesIds
                    .map((ruleId) => {
                        const rule = codyRules.find((kr) => kr.uuid === ruleId);
                        return rule?.severity;
                    })
                    .filter(Boolean);

                if (severities && severities.length > 0) {
                    const firstSeverity = severities[0];
                    if (firstSeverity) {
                        return {
                            ...suggestion,
                            severity:
                                firstSeverity.toLowerCase() as SeverityLevel,
                        };
                    }
                }

                return suggestion;
            },
        );

        return {
            codeSuggestions: updatedSuggestions,
        };
    }

    private async filterRulesByMinimumSeverity(
        rules: Array<Partial<ICodyRule>>,
        minimalSeverityLevel?: SeverityLevel,
    ): Promise<Array<Partial<ICodyRule>>> {
        // If no minimum level defined or it is LOW, return all rules
        if (
            !minimalSeverityLevel ||
            minimalSeverityLevel === SeverityLevel.LOW
        ) {
            return rules;
        }

        // Define severity hierarchy (from lowest to highest)
        const severityHierarchy = {
            [SeverityLevel.LOW]: 1,
            [SeverityLevel.MEDIUM]: 2,
            [SeverityLevel.HIGH]: 3,
            [SeverityLevel.CRITICAL]: 4,
        };

        const minimalLevel = severityHierarchy[minimalSeverityLevel];

        return rules.filter((rule) => {
            if (!rule.severity) {
                // If rule has no severity defined, include by default
                return true;
            }

            // Fix: normalize to lowercase to match enum
            const ruleSeverity = rule.severity.toLowerCase() as SeverityLevel;
            const ruleLevel = severityHierarchy[ruleSeverity];

            // If severity mapping fails, include for safety
            if (ruleLevel === undefined) {
                this.logger.warn({
                    message:
                        'Rule severity not recognized, including by default',
                    context: CodyRulesPrLevelAnalysisService.name,
                    metadata: {
                        ruleId: rule.uuid,
                        ruleSeverity: rule.severity,
                        normalizedSeverity: ruleSeverity,
                    },
                });
                return true;
            }

            // Include only rules with severity >= minimum level
            return ruleLevel >= minimalLevel;
        });
    }
    //#endregion

    //#region Auxiliary Methods
    private async mapViolatedRulesToSuggestions(
        violatedRules: ExtendedCodyRuleWithSuggestions[],
    ): Promise<ISuggestionByPR[]> {
        const allSuggestions: ISuggestionByPR[] = [];

        for (const rule of violatedRules) {
            if (!rule.violations?.length) {
                continue;
            }

            for (const violation of rule.violations) {
                const suggestion: ISuggestionByPR = {
                    id: uuidv4(),
                    suggestionContent: violation.suggestionContent,
                    oneSentenceSummary: violation.oneSentenceSummary,
                    label: LabelType.CODY_RULES,
                    brokenCodyRulesIds: [rule.uuid!],
                    deliveryStatus: DeliveryStatus.NOT_SENT,
                    files: {
                        violatedFileSha: violation?.violatedFileSha || [],
                        relatedFileSha: violation?.relatedFileSha || [],
                    },
                };

                allSuggestions.push(suggestion);
            }
        }

        return allSuggestions;
    }

    private buildTags(
        provider: LLMModelProvider,
        tier: 'primary' | 'fallback',
    ) {
        return [`model:${provider}`, `tier:${tier}`, 'codyRules', 'prLevel'];
    }
    //#endregion
}
