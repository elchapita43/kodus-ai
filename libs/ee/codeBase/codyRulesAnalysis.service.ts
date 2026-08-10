import { type ContextPack } from '@libs/ai-engine/infrastructure/adapters/services/context/context-pack';
import { createLogger } from '@libs/core/log/logger';
import {
    BYOKConfig,
    LLMModelProvider,
    ParserType,
    PromptRole,
    PromptRunnerService,
} from '@codus/codus-common/llm';
import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

import {
    getAugmentationsFromPack,
    getOverridesFromPack,
} from '@libs/ai-engine/infrastructure/adapters/services/context/code-review-context.utils';
import type { ContextAugmentationsMap } from '@libs/ai-engine/infrastructure/adapters/services/context/interfaces/code-review-context-pack.interface';
import {
    CODE_BASE_CONFIG_SERVICE_TOKEN,
    ICodeBaseConfigService,
} from '@libs/code-review/domain/contracts/CodeBaseConfigService.contract';
import { ICodyRulesAnalysisService } from '@libs/code-review/domain/contracts/CodyRulesAnalysisService.contract';
import { buildCodyRuleLink } from '@libs/code-review/utils/build-cody-rule-link';
import { LabelType } from '@libs/common/utils/codeManagement/labels';
import { SeverityLevel } from '@libs/common/utils/enums/severityLevel.enum';
import {
    CodyRulesClassifierSchema,
    codyRulesClassifierSchema,
    codyRulesGeneratorSchema,
    prompt_codyrules_classifier_system,
    prompt_codyrules_classifier_user,
    prompt_codyrules_extract_id_system,
    prompt_codyrules_extract_id_user,
    prompt_codyrules_guardian_system,
    prompt_codyrules_guardian_user,
    prompt_codyrules_suggestiongeneration_system,
    prompt_codyrules_suggestiongeneration_user,
    prompt_codyrules_updatestdsuggestions_system,
    prompt_codyrules_updatestdsuggestions_user,
} from '@libs/common/utils/langchainCommon/prompts/codyRules';
import { tryParseJSONObject } from '@libs/common/utils/transforms/json';
import {
    AIAnalysisResult,
    AnalysisContext,
    CodeReviewConfig,
    CodeSuggestion,
    DocumentationContextItem,
    FileChangeContext,
    ReviewModeResponse,
    ReviewOptions,
    SuggestionControlConfig,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { BYOKPromptRunnerService } from '@libs/core/infrastructure/services/tokenTracking/byokPromptRunner.service';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { CODY_RULES_SERVICE_TOKEN } from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    ICodyRule,
    CodyRulesScope,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { ExternalReferenceLoaderService } from '@libs/codyRules/infrastructure/adapters/services/externalReferenceLoader.service';
import { CodyRulesValidationService } from '../codyRules/service/cody-rules-validation.service';
import { CodyRulesService } from '../codyRules/service/codyRules.service';

interface CodyRulesExtendedContext {
    pullRequest: any;
    patchWithLinesStr: string;
    maxSuggestionsParams?: number;
    language?: string;
    filePath: string;
    languageResultPrompt?: string;
    reviewOptions?: ReviewOptions;
    fileContent?: string;
    limitationType?: string;
    severityLevelFilter?: SeverityLevel;
    organizationAndTeamData: OrganizationAndTeamData;
    codyRules: Array<Partial<ICodyRule>>;
    memories?: Array<Partial<ICodyRule>>;
    documentationContext?: DocumentationContextItem[];
    v2PromptOverrides?: CodeReviewConfig['v2PromptOverrides'];
    contextAugmentations?: ContextAugmentationsMap;
    contextPack?: ContextPack;

    standardSuggestions?: AIAnalysisResult;
    updatedSuggestions?: AIAnalysisResult;
    filteredCodyRules?: Array<Partial<ICodyRule>>;
    externalReferencesMap?: Map<string, any[]>;
    mcpResultsMap?: Map<string, Record<string, unknown>>;
}

export const CODY_RULES_ANALYSIS_SERVICE_TOKEN = Symbol(
    'CodyRulesAnalysisService',
);

@Injectable()
export class CodyRulesAnalysisService implements ICodyRulesAnalysisService {
    private readonly logger = createLogger(CodyRulesAnalysisService.name);

    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: CodyRulesService,
        @Inject(CODE_BASE_CONFIG_SERVICE_TOKEN)
        private readonly codeBaseConfigService: ICodeBaseConfigService,
        private readonly promptRunnerService: PromptRunnerService,
        private readonly codyRulesValidationService: CodyRulesValidationService,
        private readonly observabilityService: ObservabilityService,
        private readonly externalReferenceLoaderService: ExternalReferenceLoaderService,
    ) {}

    private async buildCodyRuleLinkAndRepalceIds(
        foundIds: string[],
        updatedContent: string,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
    ): Promise<string> {
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
                    text.replace(/([[\\`*_{}()#+\-.!\]])/g, '\\$1');
                const markdownLink = `[${escapeMarkdownSyntax(rule.title)}](${ruleLink})`;

                // Check if ID is between single backticks `id`
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

                // Check if ID is between triple backticks ```id```
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
                    context: CodyRulesAnalysisService.name,
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

    // Helper function to escape special characters in regex
    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async replaceCodyRuleIdsWithLinks(
        suggestions: AIAnalysisResult,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        byokConfig?: BYOKConfig,
    ): Promise<AIAnalysisResult> {
        if (!suggestions?.codeSuggestions?.length) {
            return suggestions;
        }

        const updatedSuggestions = await Promise.all(
            suggestions.codeSuggestions.map(async (suggestion) => {
                try {
                    if (suggestion?.label === LabelType.CODY_RULES) {
                        let updatedContent =
                            suggestion?.suggestionContent || '';

                        const uuidRegex =
                            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
                        let foundIds: string[] =
                            updatedContent.match(uuidRegex) || [];

                        if (!foundIds?.length) {
                            let extractedIds: string[] = [];

                            const brokenIds = (suggestion as any)
                                ?.brokenCodyRulesIds;

                            const violatedIds = (suggestion as any)
                                ?.violatedCodyRulesIds;

                            if (suggestion?.suggestionContent) {
                                if (brokenIds?.length > 0) {
                                    const firstRuleId = brokenIds[0];
                                    updatedContent += `\n\nCody Rule violation: ${firstRuleId}`;
                                    foundIds = [firstRuleId];
                                } else if (violatedIds?.length > 0) {
                                    const firstRuleId = violatedIds[0];
                                    updatedContent += `\n\nCody Rule violation: ${firstRuleId}`;
                                    foundIds = [firstRuleId];
                                } else {
                                    extractedIds =
                                        await this.extractCodyRuleIdsFromContent(
                                            updatedContent,
                                            organizationAndTeamData,
                                            prNumber,
                                            suggestion,
                                            byokConfig,
                                        );
                                    if (extractedIds.length > 0) {
                                        foundIds = extractedIds;
                                    }
                                }
                            }
                        }

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
                        context: CodyRulesAnalysisService.name,
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

    private async extractCodyRuleIdsFromContent(
        updatedContent: string,
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        suggestion: Partial<CodeSuggestion>,
        byokConfig?: BYOKConfig,
    ): Promise<string[]> {
        try {
            const provider = LLMModelProvider.GEMINI_2_5_FLASH;
            const fallbackProvider = LLMModelProvider.GEMINI_2_5_PRO;

            const promptRunner = new BYOKPromptRunnerService(
                this.promptRunnerService,
                provider,
                fallbackProvider,
                byokConfig,
            );

            const runName = 'extractCodyRuleIdsFromContent';
            const spanName = `${CodyRulesAnalysisService.name}::${runName}`;
            const spanAttrs = {
                type: promptRunner.executeMode,
                organizationId: organizationAndTeamData?.organizationId,
                teamId: organizationAndTeamData?.teamId,
                prNumber,
                suggestionId: suggestion?.id,
            };

            const { result: extraction } =
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
                            .setPayload({ suggestionContent: updatedContent })
                            .addPrompt({
                                prompt: prompt_codyrules_extract_id_system,
                                role: PromptRole.SYSTEM,
                            })
                            .addPrompt({
                                prompt: prompt_codyrules_extract_id_user,
                                role: PromptRole.USER,
                            })
                            .addMetadata({
                                organizationId:
                                    organizationAndTeamData?.organizationId,
                                teamId: organizationAndTeamData?.teamId,
                                pullRequestId: prNumber,
                                provider:
                                    byokConfig?.main?.provider || provider,
                                fallbackProvider:
                                    byokConfig?.fallback?.provider ||
                                    fallbackProvider,
                                model: byokConfig?.main?.model,
                                fallbackModel: byokConfig?.fallback?.model,
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

            if (!extraction) {
                const message = `No Cody Rule IDs extracted from content for PR#${prNumber}`;
                this.logger.warn({
                    message,
                    context: CodyRulesAnalysisService.name,
                    metadata: {
                        organizationAndTeamData,
                        prNumber,
                        suggestionId: suggestion.id,
                    },
                });
                throw new Error(message);
            }

            if (extraction) {
                const cleanResponse = extraction.replace(/```json\n|```/g, '');
                const parsedIds = tryParseJSONObject(cleanResponse);

                if (parsedIds?.ids?.length) {
                    return parsedIds.ids;
                }
            }
        } catch (error) {
            this.logger.error({
                message: 'Error in LLM fallback for ID extraction',
                context: CodyRulesAnalysisService.name,
                error,
                metadata: {
                    suggestionId: suggestion.id,
                    organizationAndTeamData,
                    prNumber,
                },
            });
        }

        return [];
    }

    async analyzeCodeWithAI(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        fileContext: FileChangeContext,
        reviewModeResponse: ReviewModeResponse.HEAVY_MODE,
        context: AnalysisContext,
        suggestions?: AIAnalysisResult,
    ): Promise<AIAnalysisResult> {
        const hasCodeSuggestions =
            !!suggestions &&
            !!suggestions?.codeSuggestions &&
            suggestions?.codeSuggestions?.length > 0;
        const provider = LLMModelProvider.GEMINI_2_5_PRO;
        // Fallback to a Vertex (SA-auth) Gemini model. The legacy v2 engine
        // builds Vertex models via `ChatVertexAI` (Gemini protocol only), so
        // `VERTEX_CLAUDE_3_5_SONNET` was silently broken as a fallback here.
        // Claude on Vertex is supported via BYOK (v5) only.
        const fallbackProvider = LLMModelProvider.VERTEX_GEMINI_2_5_PRO;

        const baseContext = await this.prepareAnalysisContext(
            fileContext,
            context,
        );

        if (!baseContext.codyRules?.length) {
            this.logger.log({
                message: `No Cody Rules applicable for file: ${fileContext?.file?.filename} from PR#${prNumber}`,
                context: CodyRulesAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    filename: fileContext?.file?.filename,
                    codyRulesCount: baseContext.codyRules?.length || 0,
                },
            });

            return { codeSuggestions: [] };
        }

        const { referencesMap: externalReferencesMap } =
            await this.externalReferenceLoaderService.loadReferencesForRules(
                baseContext.codyRules,
                context,
            );

        const rulesWithLoadedReferences = baseContext.codyRules.filter(
            (rule) => {
                const fullRule = rule as Partial<ICodyRule>;
                if (!fullRule.contextReferenceId) {
                    return true;
                }

                if (fullRule.uuid) {
                    const hasKnowledge = externalReferencesMap.has(
                        fullRule.uuid,
                    );

                    if (hasKnowledge) {
                        return true;
                    }
                }

                this.logger.warn({
                    message:
                        'Skipping rule with contextReferenceId that failed to load references or MCP results',
                    context: CodyRulesAnalysisService.name,
                    metadata: {
                        ruleUuid: fullRule.uuid,
                        ruleTitle: fullRule.title,
                        contextReferenceId: fullRule.contextReferenceId,
                    },
                });

                return false;
            },
        );

        if (rulesWithLoadedReferences.length === 0) {
            this.logger.log({
                message: `No rules with external context (knowledge or MCP) for file: ${fileContext?.file?.filename}`,
                context: CodyRulesAnalysisService.name,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    filename: fileContext?.file?.filename,
                },
            });
            return { codeSuggestions: [] };
        }

        baseContext.codyRules = rulesWithLoadedReferences;

        let extendedContext = {
            ...baseContext,
            standardSuggestions: hasCodeSuggestions ? suggestions : undefined,
            updatedSuggestions: undefined,
            filteredCodyRules: undefined,
            externalReferencesMap,
        };

        const runName = 'codyRulesAnalyzeCodeWithAI';
        const spanName = `${CodyRulesAnalysisService.name}::${runName}`;

        const promptRunner = new BYOKPromptRunnerService(
            this.promptRunnerService,
            provider,
            fallbackProvider,
            context?.codeReviewConfig?.byokConfig,
        );

        const spanAttrs = {
            type: promptRunner.executeMode,
            organizationId: organizationAndTeamData?.organizationId,
            prNumber,
            file: { name: fileContext?.file?.filename },
        };

        const byokConfigRef = context?.codeReviewConfig?.byokConfig;

        try {
            const { result } = await this.observabilityService.runLLMInSpan({
                spanName,
                runName,
                attrs: spanAttrs,
                byokConfig: byokConfigRef,
                exec: async (callbacks) => {
                    const classifier = this.getClassifier(
                        promptRunner,
                        provider,
                        fallbackProvider,
                        extendedContext,
                        context?.codeReviewConfig?.byokConfig,
                        callbacks,
                    );
                    const updater = this.getUpdater(
                        promptRunner,
                        provider,
                        fallbackProvider,
                        extendedContext,
                        context?.codeReviewConfig?.byokConfig,
                        callbacks,
                    );

                    const [
                        classifiedRulesResult,
                        updateStandardSuggestionsResult,
                    ] = await Promise.all([
                        classifier.execute(),
                        hasCodeSuggestions
                            ? updater?.execute()
                            : Promise.resolve(undefined),
                    ]);

                    const classifiedRules = this.processClassifierResponse(
                        baseContext.codyRules,
                        classifiedRulesResult,
                    );

                    const updatedSuggestions = this.processUpdatedSuggestions(
                        organizationAndTeamData,
                        prNumber,
                        updateStandardSuggestionsResult,
                        fileContext,
                        provider,
                        extendedContext,
                    );

                    if (!classifiedRules || classifiedRules?.length === 0) {
                        if (updatedSuggestions) {
                            const out = this.addSeverityToSuggestions(
                                updatedSuggestions,
                                context?.codeReviewConfig?.codyRules || [],
                            );
                            return { shortCircuit: true, output: out };
                        }
                        return {
                            shortCircuit: true,
                            output: { codeSuggestions: [] },
                        };
                    }

                    extendedContext = {
                        ...extendedContext,
                        filteredCodyRules: classifiedRules,
                        updatedSuggestions: updatedSuggestions ?? undefined,
                    };

                    const generator = this.getGenerator(
                        promptRunner,
                        provider,
                        fallbackProvider,
                        extendedContext,
                        context?.codeReviewConfig?.byokConfig,
                        callbacks,
                    );

                    const generatedCodyRulesSuggestionsResult =
                        await generator.execute();

                    return {
                        shortCircuit: false,
                        generatedCodyRulesSuggestionsResult,
                        updatedSuggestions,
                    };
                },
            });

            if (result?.shortCircuit) {
                return result.output as AIAnalysisResult;
            }

            const generatedCodyRulesSuggestions = this.processLLMResponse(
                organizationAndTeamData,
                prNumber,
                result.generatedCodyRulesSuggestionsResult,
                fileContext,
                provider,
                extendedContext,
            );

            const finalOutput: AIAnalysisResult = {
                codeSuggestions: [
                    ...(generatedCodyRulesSuggestions?.codeSuggestions ?? []),
                ],
            };

            if (result?.updatedSuggestions) {
                finalOutput.codeSuggestions = [
                    ...finalOutput.codeSuggestions,
                    ...(result.updatedSuggestions?.codeSuggestions ?? []),
                ];
            }

            const finalOutputWithLinks = await this.replaceCodyRuleIdsWithLinks(
                finalOutput,
                organizationAndTeamData,
                prNumber,
                context?.codeReviewConfig?.byokConfig,
            );

            return this.addSeverityToSuggestions(
                finalOutputWithLinks,
                context?.codeReviewConfig?.codyRules || [],
            );
        } catch (error) {
            this.logger.error({
                message: `Error during LLM code analysis for PR#${prNumber}`,
                context: CodyRulesAnalysisService.name,
                metadata: {
                    organizationAndTeamData: context?.organizationAndTeamData,
                    prNumber: context?.pullRequest?.number,
                },
                error,
            });
            throw error;
        }
    }

    private getClassifier(
        promptRunner: BYOKPromptRunnerService,
        provider: LLMModelProvider,
        fallbackProvider: LLMModelProvider,
        context: CodyRulesExtendedContext,
        byokConfig?: BYOKConfig,
        callbacks?: any[],
    ) {
        const builder = promptRunner
            .builder()
            .setParser(ParserType.ZOD, codyRulesClassifierSchema, {
                provider: LLMModelProvider.OPENAI_GPT_4O_MINI,
                fallbackProvider: LLMModelProvider.OPENAI_GPT_4O,
            })
            .setLLMJsonMode(true)
            .setTemperature(0)
            .setPayload(context)
            .addPrompt({
                prompt: prompt_codyrules_classifier_system,
                role: PromptRole.SYSTEM,
            })
            .addPrompt({
                prompt: prompt_codyrules_classifier_user,
                role: PromptRole.USER,
            })
            .addMetadata({
                organizationId:
                    context?.organizationAndTeamData?.organizationId,
                teamId: context?.organizationAndTeamData?.teamId,
                pullRequestId: context?.pullRequest?.number,
                provider: byokConfig?.main?.provider || provider,
                fallbackProvider:
                    byokConfig?.fallback?.provider || fallbackProvider,
                model: byokConfig?.main?.model,
                fallbackModel: byokConfig?.fallback?.model,
                runName: 'classifierCodyRulesAnalyzeCodeWithAI',
            })
            .addTags([
                ...this.buildTags(provider, 'primary'),
                ...this.buildTags(fallbackProvider, 'fallback'),
            ])
            .setRunName('classifierCodyRulesAnalyzeCodeWithAI');

        if (callbacks?.length) {
            builder.addCallbacks(callbacks);
        }

        return builder;
    }

    private getUpdater(
        promptRunner: BYOKPromptRunnerService,
        provider: LLMModelProvider,
        fallbackProvider: LLMModelProvider,
        context: CodyRulesExtendedContext,
        byokConfig?: BYOKConfig,
        callbacks?: any[],
    ) {
        const builder = promptRunner
            .builder()
            .setParser(ParserType.STRING)
            .setLLMJsonMode(true)
            .setTemperature(0)
            .setPayload(context)
            .addPrompt({
                prompt: prompt_codyrules_updatestdsuggestions_system,
                role: PromptRole.SYSTEM,
            })
            .addPrompt({
                prompt: prompt_codyrules_updatestdsuggestions_user,
                role: PromptRole.USER,
            })
            .addMetadata({
                organizationId:
                    context?.organizationAndTeamData?.organizationId,
                teamId: context?.organizationAndTeamData?.teamId,
                pullRequestId: context?.pullRequest?.number,
                provider: byokConfig?.main?.provider || provider,
                fallbackProvider:
                    byokConfig?.fallback?.provider || fallbackProvider,
                model: byokConfig?.main?.model,
                fallbackModel: byokConfig?.fallback?.model,
                runName: 'updateStandardSuggestionsAnalyzeCodeWithAI',
            })
            .addTags([
                ...this.buildTags(provider, 'primary'),
                ...this.buildTags(fallbackProvider, 'fallback'),
            ])
            .setRunName('updateStandardSuggestionsAnalyzeCodeWithAI');

        if (callbacks?.length) {
            builder.addCallbacks(callbacks);
        }

        return builder;
    }

    private getGuardian(
        promptRunner: BYOKPromptRunnerService,
        provider: LLMModelProvider,
        fallbackProvider: LLMModelProvider,
        context: CodyRulesExtendedContext,
        byokConfig?: BYOKConfig,
        callbacks?: any[],
    ) {
        const builder = promptRunner
            .builder()
            .setParser(ParserType.STRING) // mantém a lógica atual
            .setLLMJsonMode(true) // idem
            .setTemperature(0)
            .setPayload(context)
            .addPrompt({
                prompt: prompt_codyrules_guardian_system,
                role: PromptRole.SYSTEM,
            })
            .addPrompt({
                prompt: prompt_codyrules_guardian_user,
                role: PromptRole.USER,
            })
            .addMetadata({
                organizationId:
                    context?.organizationAndTeamData?.organizationId,
                teamId: context?.organizationAndTeamData?.teamId,
                pullRequestId: context?.pullRequest?.number,
                provider: byokConfig?.main?.provider || provider,
                fallbackProvider:
                    byokConfig?.fallback?.provider || fallbackProvider,
                model: byokConfig?.main?.model,
                fallbackModel: byokConfig?.fallback?.model,
                runName: 'guardianCodyRulesAnalyzeCodeWithAI',
            })
            .addTags([
                ...this.buildTags(provider, 'primary'),
                ...this.buildTags(fallbackProvider, 'fallback'),
            ])
            .setRunName('guardianCodyRulesAnalyzeCodeWithAI');

        if (callbacks?.length) {
            builder.addCallbacks(callbacks);
        }

        return builder;
    }

    private getGenerator(
        promptRunner: BYOKPromptRunnerService,
        provider: LLMModelProvider,
        fallbackProvider: LLMModelProvider,
        context: CodyRulesExtendedContext,
        byokConfig?: BYOKConfig,
        callbacks?: any[],
    ) {
        const builder = promptRunner
            .builder()
            .setParser(ParserType.ZOD, codyRulesGeneratorSchema, {
                provider: LLMModelProvider.OPENAI_GPT_4O_MINI,
                fallbackProvider: LLMModelProvider.OPENAI_GPT_4O,
            })
            .setLLMJsonMode(true)
            .setTemperature(0)
            .setPayload(context)
            .addPrompt({
                prompt: prompt_codyrules_suggestiongeneration_system,
                role: PromptRole.SYSTEM,
            })
            .addPrompt({
                prompt: prompt_codyrules_suggestiongeneration_user,
                role: PromptRole.USER,
            })
            .addMetadata({
                organizationId:
                    context?.organizationAndTeamData?.organizationId,
                teamId: context?.organizationAndTeamData?.teamId,
                pullRequestId: context?.pullRequest?.number,
                provider: byokConfig?.main?.provider || provider,
                fallbackProvider:
                    byokConfig?.fallback?.provider || fallbackProvider,
                model: byokConfig?.main?.model,
                fallbackModel: byokConfig?.fallback?.model,
                runName: 'suggestionGenerationCodyRulesAnalyzeCodeWithAI',
            })
            .addTags([
                ...this.buildTags(provider, 'primary'),
                ...this.buildTags(fallbackProvider, 'fallback'),
            ])
            .setRunName('suggestionGenerationCodyRulesAnalyzeCodeWithAI');

        if (callbacks?.length) {
            builder.addCallbacks(callbacks);
        }

        return builder;
    }

    private addSeverityToSuggestions(
        suggestions: AIAnalysisResult,
        codyRules: Array<Partial<ICodyRule>>,
    ): AIAnalysisResult {
        if (!suggestions?.codeSuggestions?.length || !codyRules?.length) {
            return suggestions;
        }

        const updatedSuggestions = suggestions.codeSuggestions.map(
            (
                suggestion: Partial<CodeSuggestion> & {
                    brokenCodyRulesIds?: string[];
                },
            ) => {
                if (!suggestion.brokenCodyRulesIds?.length) {
                    return suggestion;
                }

                // For each broken rule, find the severity in codyRules
                const severities = suggestion.brokenCodyRulesIds
                    .map((ruleId) => {
                        const rule = codyRules.find((kr) => kr.uuid === ruleId);
                        return rule?.severity;
                    })
                    .filter(Boolean);

                // If there are severities, use the first one
                if (severities && severities.length > 0) {
                    return {
                        ...suggestion,
                        severity: severities[0]?.toLowerCase(),
                    };
                }

                return suggestion;
            },
        );

        return {
            ...suggestions,
            codeSuggestions: updatedSuggestions,
        };
    }

    private async prepareAnalysisContext(
        fileContext: FileChangeContext,
        context: AnalysisContext,
    ) {
        let directoryId = context?.codeReviewConfig?.directoryId;
        if (!directoryId) {
            directoryId =
                await this.codeBaseConfigService.getDirectoryIdForPath(
                    context?.organizationAndTeamData,
                    {
                        id: context?.repository?.id || '',
                        name: context?.repository?.name || '',
                    },
                    fileContext?.file?.filename || '',
                );
        }

        const codyRulesFiltered = this.codyRulesValidationService
            .getCodyRulesForFile(
                fileContext.file.filename,
                context?.codeReviewConfig?.codyRules || [],
                {
                    ...(directoryId
                        ? { directoryId }
                        : { repositoryId: context?.repository?.id }),
                },
            )
            ?.filter(
                (rule) => !rule.scope || rule.scope === CodyRulesScope.FILE,
            )
            ?.map((rule) => ({
                uuid: rule?.uuid,
                title: rule?.title,
                rule: rule?.rule,
                severity: rule?.severity,
                examples: rule?.examples ?? [],
                contextReferenceId: rule?.contextReferenceId,
            }));

        // Grep-able evaluation trace ("[cody-rules-eval]"): the single
        // authoritative record of WHICH rules entered the prompt for this
        // file. Self-hosted operators debugging "why didn't my rule fire"
        // previously had no way to tell a rule dropped by path/scope
        // filtering from a rule the model simply ignored.
        this.logger.log({
            message: `[cody-rules-eval] ${codyRulesFiltered?.length ?? 0} rule(s) selected for file ${fileContext?.file?.filename}`,
            context: CodyRulesAnalysisService.name,
            metadata: {
                organizationAndTeamData: context?.organizationAndTeamData,
                prNumber: context?.pullRequest?.number,
                filename: fileContext?.file?.filename,
                totalActiveRules:
                    context?.codeReviewConfig?.codyRules?.length ?? 0,
                selectedRules: (codyRulesFiltered ?? []).map((r) => ({
                    uuid: r.uuid,
                    title: r.title,
                })),
            },
        });

        const baseContext = {
            pullRequest: context?.pullRequest,
            patchWithLinesStr: fileContext?.patchWithLinesStr,
            maxSuggestionsParams:
                context?.codeReviewConfig?.suggestionControl?.maxSuggestions,
            language: context?.repository?.language,
            filePath: fileContext?.file?.filename,
            languageResultPrompt:
                context?.codeReviewConfig?.languageResultPrompt,
            reviewOptions: context?.codeReviewConfig?.reviewOptions,
            fileContent: fileContext?.file?.fileContent,
            limitationType:
                context?.codeReviewConfig?.suggestionControl?.limitationType,
            // ✨ MODIFICATION: only pass severityLevelFilter if filters should be applied
            severityLevelFilter: this.shouldPassSeverityFilter(
                context?.codeReviewConfig?.suggestionControl,
            )
                ? context?.codeReviewConfig?.suggestionControl
                      ?.severityLevelFilter
                : undefined,
            organizationAndTeamData: context?.organizationAndTeamData,
            codyRules: codyRulesFiltered,
            memories: context?.codeReviewConfig?.codyMemoryRules || [],
            v2PromptOverrides:
                context?.activeOverrides ??
                getOverridesFromPack(context?.sharedContextPack) ??
                context?.codeReviewConfig?.v2PromptOverrides,
            externalPromptLayers: context?.externalPromptLayers,
            contextAugmentations: {
                ...(getAugmentationsFromPack(context?.sharedContextPack) ?? {}),
                ...(context?.fileAugmentations ?? {}),
            } as ContextAugmentationsMap,
            contextPack: context?.sharedContextPack as ContextPack | undefined,
            documentationContext: context?.documentationContext || [],
        };

        return baseContext;
    }

    /**
     * ✨ SIMPLIFIED: Determines if severityLevelFilter should be passed for Cody Rules analysis
     */
    private shouldPassSeverityFilter(
        suggestionControl?: SuggestionControlConfig,
    ): boolean {
        if (!suggestionControl) {
            return false;
        }

        // Returns true only if filters are explicitly enabled for Cody Rules
        return suggestionControl.applyFiltersToCodyRules === true;
    }

    private processClassifierResponse(
        allRules: Array<Partial<ICodyRule> | ICodyRule>,
        response: CodyRulesClassifierSchema,
    ): Array<Partial<ICodyRule> | ICodyRule> | null {
        try {
            if (!response || !response.rules?.length) {
                this.logger.warn({
                    message: 'No rules found in classifier response',
                    context: CodyRulesAnalysisService.name,
                    metadata: {
                        allRules,
                        response,
                    },
                });
                return null;
            }

            const responseMap = new Map(
                response.rules.map((rule) => [rule.uuid, rule.reason]),
            );

            return allRules
                .filter((rule) => rule.uuid && responseMap.has(rule.uuid))
                .map((rule) => {
                    const baseRule = { ...rule };
                    const reason = responseMap.get(rule.uuid!);
                    return { ...baseRule, reason } as Partial<ICodyRule>;
                });
        } catch (error) {
            this.logger.error({
                message: 'Error processing classifier response',
                context: CodyRulesAnalysisService.name,
                error,
                metadata: {
                    allRules,
                    response,
                },
            });
            return null;
        }
    }

    private processSuggestionLabels(
        suggestions: CodeSuggestion[],
        reviewOptions: ReviewOptions,
    ): CodeSuggestion[] {
        const availableLabels = Object.keys(reviewOptions);

        return suggestions.map((suggestion) => {
            if (
                (suggestion.label ?? '') === '' ||
                !availableLabels.includes(suggestion?.label)
            ) {
                return {
                    ...suggestion,
                    label: 'cody_rules',
                };
            }

            return suggestion;
        });
    }

    private processLLMResponse(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        response: any,
        fileContext: FileChangeContext,
        provider: LLMModelProvider,
        extendedContext: CodyRulesExtendedContext,
    ): AIAnalysisResult | null {
        try {
            if (!response) {
                return null;
            }

            // Normalize the types of fields that may come as strings
            if (response?.codeSuggestions) {
                response.codeSuggestions = response.codeSuggestions.map(
                    (suggestion) => {
                        if (!suggestion?.id || !uuidValidate(suggestion?.id)) {
                            return {
                                ...suggestion,
                                id: uuidv4(),
                            };
                        }
                        return suggestion;
                    },
                );

                if (extendedContext?.reviewOptions) {
                    response.codeSuggestions = this.processSuggestionLabels(
                        response.codeSuggestions,
                        extendedContext.reviewOptions,
                    );
                } else {
                    response.codeSuggestions = response.codeSuggestions.map(
                        (suggestion) => ({
                            ...suggestion,
                            label: suggestion.label ?? 'cody_rules',
                        }),
                    );
                }
            }

            this.logTokenUsage({
                tokenUsages: response.codeSuggestions,
                pullRequestId: prNumber,
                fileContext: fileContext?.file?.filename,
                provider,
                organizationAndTeamData,
            });

            return {
                codeSuggestions: response.codeSuggestions || [],
            };
        } catch (error) {
            this.logger.error({
                message: `Error processing LLM response for PR#${prNumber}`,
                context: CodyRulesAnalysisService.name,
                error,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    response,
                },
            });
            return null;
        }
    }

    /**
     * Specifically processes updatedSuggestions with differentiated logic
     * for violated vs broken cody rules
     */
    private processUpdatedSuggestions(
        organizationAndTeamData: OrganizationAndTeamData,
        prNumber: number,
        response: string,
        fileContext: FileChangeContext,
        _provider: LLMModelProvider,
        _extendedContext: CodyRulesExtendedContext,
    ): AIAnalysisResult | null {
        // Tipo específico para a resposta do UPDATE
        interface CodyRulesUpdateResponse {
            codeSuggestions?: Array<{
                id?: string;
                relevantFile?: string;
                language?: string;
                suggestionContent?: string;
                existingCode?: string;
                improvedCode?: string;
                oneSentenceSummary?: string;
                relevantLinesStart?: number | string;
                relevantLinesEnd?: number | string;
                label?: string;
                severity?: string;
                violatedCodyRulesIds?: string[];
                brokenCodyRulesIds?: string[];
                llmPrompt?: string;
            }>;
        }

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

            const parsedResponse = tryParseJSONObject(
                cleanResponse,
            ) as CodyRulesUpdateResponse | null;

            if (!parsedResponse) {
                this.logger.error({
                    message: 'Failed to parse UPDATE response',
                    context: CodyRulesAnalysisService.name,
                    metadata: {
                        organizationAndTeamData,
                        originalResponse: response,
                        cleanResponse,
                        prNumber,
                    },
                });
                return null;
            }

            const processedSuggestions: CodeSuggestion[] = [];

            if (parsedResponse.codeSuggestions) {
                for (const suggestion of parsedResponse.codeSuggestions) {
                    const normalizedSuggestion: CodeSuggestion = {
                        id:
                            !suggestion?.id || !uuidValidate(suggestion?.id)
                                ? uuidv4()
                                : suggestion.id,
                        relevantFile: suggestion.relevantFile || '',
                        language: suggestion.language,
                        suggestionContent: suggestion.suggestionContent || '',
                        existingCode: suggestion.existingCode,
                        improvedCode: suggestion.improvedCode,
                        oneSentenceSummary: suggestion.oneSentenceSummary,
                        relevantLinesStart:
                            Number(suggestion.relevantLinesStart) || undefined,
                        relevantLinesEnd:
                            Number(suggestion.relevantLinesEnd) || undefined,
                        label: suggestion.label,
                        severity: suggestion.severity,
                        llmPrompt: suggestion.llmPrompt,
                    };

                    // "Has violated" means a standard suggestion violates a cody rule, so we silently fix it.
                    const hasViolated =
                        suggestion.violatedCodyRulesIds?.length &&
                        suggestion.violatedCodyRulesIds.length > 0;

                    // "Has broken" means that a standard suggestion could potentially be a cody rule, so we merge it
                    const hasBroken =
                        suggestion.brokenCodyRulesIds?.length &&
                        suggestion.brokenCodyRulesIds.length > 0;

                    if (hasBroken) {
                        processedSuggestions.push({
                            ...normalizedSuggestion,
                            label: 'cody_rules',
                            brokenCodyRulesIds: suggestion.brokenCodyRulesIds,
                        });
                    } else if (hasViolated) {
                        processedSuggestions.push({
                            ...normalizedSuggestion,
                            label: suggestion.label,
                            // violatedCodyRulesIds is just for internal use, so we don't save it
                        });
                    } else {
                        processedSuggestions.push(normalizedSuggestion);
                    }
                }
            }

            return {
                codeSuggestions: processedSuggestions,
            };
        } catch (error) {
            this.logger.error({
                message: `Error processing UPDATE response for PR#${prNumber}`,
                context: CodyRulesAnalysisService.name,
                error,
                metadata: {
                    organizationAndTeamData,
                    prNumber,
                    response,
                    filename: fileContext?.file?.filename,
                },
            });
            return null;
        }
    }

    private buildTags(
        provider: LLMModelProvider,
        tier: 'primary' | 'fallback',
    ) {
        return [`model:${provider}`, `tier:${tier}`, 'codyRules'];
    }

    private async logTokenUsage(metadata: any) {
        // Log token usage for analysis and monitoring
        this.logger.log({
            message: 'Token usage',
            context: CodyRulesAnalysisService.name,
            metadata: {
                ...metadata,
            },
        });
    }
}
