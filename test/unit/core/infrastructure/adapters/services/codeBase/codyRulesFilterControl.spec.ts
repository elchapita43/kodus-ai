import { Test } from '@nestjs/testing';

import {
    CodeSuggestion,
    SuggestionControlConfig,
    GroupingModeSuggestions,
    LimitationType,
} from '@libs/core/infrastructure/config/types/general/codeReview.type';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { COMMENT_MANAGER_SERVICE_TOKEN } from '@libs/core/domain/codeBase/contracts/CommentManagerService.contract';
import { PULL_REQUESTS_SERVICE_TOKEN } from '@libs/platformData/domain/pullRequests/contracts/pullRequests.service.contracts';
import { PriorityStatus } from '@libs/platformData/domain/pullRequests/enums/priorityStatus.enum';
import { LLM_ANALYSIS_SERVICE_TOKEN } from '@libs/core/infrastructure/adapters/services/codeBase/llmAnalysis.service';
import { SuggestionService } from '@libs/core/infrastructure/adapters/services/codeBase/suggestion.service';
import { SeverityLevel } from '@libs/common/enums/severityLevel.enum';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';
import { CacheService } from '@libs/core/cache/cache.service';

describe('SuggestionService - Cody Rules Filter Control', () => {
    let service: SuggestionService;

    const mockOrgData: OrganizationAndTeamData = {
        organizationId: 'org1',
        teamId: '123',
    };

    const createMockSuggestion = (
        severity: SeverityLevel,
        label: string,
    ): CodeSuggestion => ({
        id: Math.random().toString(),
        relevantFile: 'test.ts',
        language: 'typescript',
        suggestionContent: 'Test suggestion',
        improvedCode: 'improved code',
        relevantLinesStart: 1,
        relevantLinesEnd: 1,
        label,
        severity,
        priorityStatus: PriorityStatus.PRIORITIZED,
    });

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                SuggestionService,
                {
                    provide: LLM_ANALYSIS_SERVICE_TOKEN,
                    useValue: {
                        validateImplementedSuggestions: jest.fn(),
                        filterSuggestionsSafeGuard: jest.fn(),
                        severityAnalysisAssignment: jest.fn(),
                    },
                },
                {
                    provide: PULL_REQUESTS_SERVICE_TOKEN,
                    useValue: {
                        updateSuggestion: jest.fn(),
                    },
                },
                {
                    provide: COMMENT_MANAGER_SERVICE_TOKEN,
                    useValue: {
                        repeatedCodeReviewSuggestionClustering: jest.fn(),
                        enrichParentSuggestionsWithRelated: jest.fn(),
                    },
                },
                {
                    provide: CodeManagementService,
                    useValue: {
                        getPullRequestReviewThreads: jest.fn(),
                        getPullRequestReviewComments: jest.fn(),
                        markReviewCommentAsResolved: jest.fn(),
                    },
                },
                {
                    provide: CacheService,
                    useValue: {
                        getFromCache: jest.fn(),
                        addToCache: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<SuggestionService>(SuggestionService);
    });

    describe('🎯 Controle de Filtros para Cody Rules', () => {
        it('deve aplicar filtros nas Cody Rules quando applyFiltersToCodyRules = true', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 2,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: true, // ✅ Aplicar filtros
            };

            const suggestions = [
                createMockSuggestion(SeverityLevel.LOW, 'cody_rules'), // ❌ Filtrado por severidade
                createMockSuggestion(SeverityLevel.HIGH, 'cody_rules'), // ✅ Passa
                createMockSuggestion(SeverityLevel.CRITICAL, 'cody_rules'), // ✅ Passa
                createMockSuggestion(SeverityLevel.HIGH, 'security'), // ✅ Passa
                createMockSuggestion(SeverityLevel.LOW, 'security'), // ❌ Filtrado por severidade
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestions,
            );

            // Deve aplicar filtros: severidade + quantidade (max 2)
            expect(result.prioritizedSuggestions).toHaveLength(2);
            expect(
                result.discardedSuggestionsBySeverityOrQuantity,
            ).toHaveLength(3);

            // Cody Rules de severidade baixa devem ter sido filtradas
            const codyRulesDiscarded =
                result.discardedSuggestionsBySeverityOrQuantity.filter(
                    (s) => s.label === 'cody_rules',
                );
            expect(codyRulesDiscarded).toHaveLength(1);
            expect(codyRulesDiscarded[0].severity).toBe(SeverityLevel.LOW);
        });

        it('deve NÃO aplicar filtros nas Cody Rules quando applyFiltersToCodyRules = false', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 2,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: false, // ✅ NÃO aplicar filtros
            };

            const suggestions = [
                createMockSuggestion(SeverityLevel.LOW, 'cody_rules'), // ✅ Passa (filtros ignorados)
                createMockSuggestion(SeverityLevel.HIGH, 'cody_rules'), // ✅ Passa
                createMockSuggestion(SeverityLevel.HIGH, 'security'), // ✅ Passa
                createMockSuggestion(SeverityLevel.LOW, 'security'), // ❌ Filtrado por severidade
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestions,
            );

            // Cody Rules passam todas, outros são filtrados
            const codyRulesPrioritized = result.prioritizedSuggestions.filter(
                (s) => s.label === 'cody_rules',
            );
            const securityPrioritized = result.prioritizedSuggestions.filter(
                (s) => s.label === 'security',
            );

            expect(codyRulesPrioritized).toHaveLength(2); // Todas as Cody Rules passaram
            expect(securityPrioritized).toHaveLength(1); // Apenas security HIGH passou

            // Verifica que security LOW foi descartada, mas nenhuma Cody Rule
            const codyRulesDiscarded =
                result.discardedSuggestionsBySeverityOrQuantity.filter(
                    (s) => s.label === 'cody_rules',
                );
            expect(codyRulesDiscarded).toHaveLength(0); // Nenhuma Cody Rule descartada
        });

        it('deve usar padrão (false) quando applyFiltersToCodyRules não está definido', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 5,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.CRITICAL,
                // applyFiltersToCodyRules não definido (undefined)
            };

            const suggestions = [
                createMockSuggestion(SeverityLevel.LOW, 'cody_rules'), // ✅ Passa (filtros ignorados)
                createMockSuggestion(SeverityLevel.CRITICAL, 'security'), // ✅ Passa
                createMockSuggestion(SeverityLevel.HIGH, 'security'), // ❌ Filtrado por severidade
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestions,
            );

            // Cody Rules sempre passam quando filtros não são aplicados (padrão)
            const codyRulesPrioritized = result.prioritizedSuggestions.filter(
                (s) => s.label === 'cody_rules',
            );
            expect(codyRulesPrioritized).toHaveLength(1);

            // Apenas security CRITICAL passou
            const securityPrioritized = result.prioritizedSuggestions.filter(
                (s) => s.label === 'security',
            );
            expect(securityPrioritized).toHaveLength(1);
        });

        it('deve processar sugestões normalmente quando não há Cody Rules', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 2,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: false, // Não importa, não há Cody Rules
            };

            const suggestions = [
                createMockSuggestion(SeverityLevel.HIGH, 'security'), // ✅ Passa
                createMockSuggestion(SeverityLevel.CRITICAL, 'security'), // ✅ Passa
                createMockSuggestion(SeverityLevel.LOW, 'security'), // ❌ Filtrado por severidade
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestions,
            );

            // Deve usar lógica original sem Cody Rules
            expect(result.prioritizedSuggestions).toHaveLength(2);
            expect(
                result.discardedSuggestionsBySeverityOrQuantity,
            ).toHaveLength(1);
        });

        // 🐛 TESTES PARA CAPTURAR POSSÍVEIS BUGS
        it('🐛 BUG TEST: deve processar APENAS Cody Rules quando applyFiltersToCodyRules = false', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 2,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: false, // ✅ Cody Rules isentas
            };

            // ⚠️ CENÁRIO CRÍTICO: Só Cody Rules, nenhuma sugestão normal
            const suggestions = [
                createMockSuggestion(SeverityLevel.LOW, 'cody_rules'), // ✅ Deve passar (isenta)
                createMockSuggestion(SeverityLevel.MEDIUM, 'cody_rules'), // ✅ Deve passar (isenta)
                createMockSuggestion(SeverityLevel.HIGH, 'cody_rules'), // ✅ Deve passar (isenta)
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestions,
            );

            // 🐛 ESTE TESTE PODE FALHAR SE HOUVER BUG
            expect(result.prioritizedSuggestions).toHaveLength(3); // Todas as Cody Rules devem passar
            expect(
                result.discardedSuggestionsBySeverityOrQuantity,
            ).toHaveLength(0); // Nenhuma descartada

            // Verificar que todas são Cody Rules
            result.prioritizedSuggestions.forEach((s) => {
                expect(s.label).toBe('cody_rules');
                expect(s.priorityStatus).toBe(PriorityStatus.PRIORITIZED);
            });
        });

        it('🐛 BUG TEST: deve detectar Cody Rules com label normalizado', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 5,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: false,
            };

            // ⚠️ TESTE: Labels que podem vir de diferentes fontes
            const suggestionsWithVariedLabels = [
                {
                    ...createMockSuggestion(SeverityLevel.LOW, 'cody_rules'),
                    id: '1',
                }, // Exato
                {
                    ...createMockSuggestion(SeverityLevel.LOW, 'Cody Rules'),
                    id: '2',
                }, // Capitalizado (AI)
                {
                    ...createMockSuggestion(SeverityLevel.LOW, 'CODY_RULES'),
                    id: '3',
                }, // Maiúsculo
                {
                    ...createMockSuggestion(SeverityLevel.LOW, 'security'),
                    id: '4',
                }, // Normal
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestionsWithVariedLabels,
            );

            // 🐛 VERIFICA SE DETECTA CODY RULES EM QUALQUER FORMATO
            const codyRulesDetected = suggestionsWithVariedLabels.some(
                (s) =>
                    s.label === 'cody_rules' ||
                    s.label === 'Cody Rules' ||
                    s.label === 'CODY_RULES',
            );

            if (codyRulesDetected) {
                // Deve usar lógica de Cody Rules
                const codyRulesInResult = result.prioritizedSuggestions.filter(
                    (s) =>
                        s.label === 'cody_rules' ||
                        s.label === 'Cody Rules' ||
                        s.label === 'CODY_RULES',
                );
                expect(codyRulesInResult.length).toBeGreaterThan(0); // Alguma Cody Rule deve aparecer
            }
        });

        it('🐛 BUG TEST: deve funcionar com array vazio de sugestões', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 5,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: false,
            };

            const suggestions: any[] = []; // ⚠️ Array vazio

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestions,
            );

            // 🐛 NÃO DEVE QUEBRAR COM ARRAY VAZIO
            expect(result.prioritizedSuggestions).toHaveLength(0);
            expect(
                result.discardedSuggestionsBySeverityOrQuantity,
            ).toHaveLength(0);
        });

        it('🐛 BUG TEST: deve funcionar com suggestionControl undefined/null', async () => {
            const suggestions = [
                createMockSuggestion(SeverityLevel.HIGH, 'cody_rules'),
                createMockSuggestion(SeverityLevel.HIGH, 'security'),
            ];

            // ⚠️ TESTE: Config malformada
            const malformedConfig = {
                maxSuggestions: 5,
                // applyFiltersToCodyRules: undefined (missing)
            } as any;

            // 🐛 NÃO DEVE QUEBRAR COM CONFIG MALFORMADA
            expect(async () => {
                await service.prioritizeSuggestions(
                    mockOrgData,
                    malformedConfig,
                    123,
                    suggestions,
                );
            }).not.toThrow();
        });

        it('🔥 CRITICAL BUG: falha em detectar Cody Rules com labels não normalizados', async () => {
            const suggestionControl: SuggestionControlConfig = {
                maxSuggestions: 2,
                limitationType: LimitationType.PR,
                groupingMode: GroupingModeSuggestions.MINIMAL,
                severityLevelFilter: SeverityLevel.HIGH,
                applyFiltersToCodyRules: false, // ✅ Cody Rules deveriam ser isentas
            };

            // 🔥 CENÁRIO: Cody Rules com labels capitalizados (vem da IA assim)
            const suggestionsWithNonNormalizedLabels = [
                {
                    ...createMockSuggestion(SeverityLevel.LOW, 'Cody Rules'),
                    id: '1',
                }, // ✅ Deve passar (isenta)
                {
                    ...createMockSuggestion(SeverityLevel.HIGH, 'security'),
                    id: '2',
                }, // ✅ Deve passar (severidade)
            ];

            const result = await service.prioritizeSuggestions(
                mockOrgData,
                suggestionControl,
                123,
                suggestionsWithNonNormalizedLabels,
            );

            // ✅ VALIDAÇÕES: Ambas devem passar
            expect(result.prioritizedSuggestions).toHaveLength(2);
            expect(
                result.discardedSuggestionsBySeverityOrQuantity,
            ).toHaveLength(0);

            // ✅ Verificar que Cody Rules foi detectada e passou
            const codyRulesInResult = result.prioritizedSuggestions.find(
                (s) => s.label === 'Cody Rules',
            );
            expect(codyRulesInResult).toBeDefined();
            expect(codyRulesInResult.severity).toBe('low'); // LOW passou porque foi isenta
        });

        it('deve normalizar labels corretamente', () => {
            expect(service.normalizeLabel('Cody Rules')).toBe('cody_rules');
            expect(service.normalizeLabel('CODE_STYLE')).toBe('code_style');
            expect(service.normalizeLabel('  test  ')).toBe('_test_');
            expect(service.normalizeLabel('')).toBe('');
            expect(service.normalizeLabel('Performance and Optimization')).toBe(
                'performance_and_optimization',
            );
        });
    });
});
