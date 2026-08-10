import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';

import { GenerateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/generate-cody-rules.use-case';
import { CODE_BASE_CONFIG_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/CodeBaseConfigService.contract';
import {
    IIntegrationService,
    INTEGRATION_SERVICE_TOKEN,
} from '@libs/integrations/domain/integrations/contracts/integration.service.contracts';
import {
    IIntegrationConfigService,
    INTEGRATION_CONFIG_SERVICE_TOKEN,
} from '@libs/integrations/domain/integrationConfigs/contracts/integration-config.service.contracts';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { CreateOrUpdateParametersUseCase } from '@libs/organization/application/use-cases/parameters/create-or-update-use-case';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';
import { CommentAnalysisService } from '@libs/code-review/infrastructure/adapters/services/commentAnalysis.service';
import { PermissionValidationService } from '@libs/ee/shared/services/permissionValidation.service';
import { SendRulesNotificationUseCase } from '@libs/codyRules/application/use-cases/send-rules-notification.use-case';
import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-rules-in-organization-by-filter.use-case';
import { CreateOrUpdateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/create-or-update.use-case';
import { ParametersKey } from '@libs/core/domain/enums';
import { CodyRulesStatus } from '@libs/codyRules/domain/interfaces/codyRules.interface';

jest.mock('@libs/core/log/logger', () => ({
    createLogger: () => ({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }),
}));

describe('GenerateCodyRulesUseCase', () => {
    let useCase: GenerateCodyRulesUseCase;

    const integrationServiceMock = {} as jest.Mocked<IIntegrationService>;
    const integrationConfigServiceMock =
        {} as jest.Mocked<IIntegrationConfigService>;
    const parametersServiceMock = {
        findByKey: jest.fn(),
    } as unknown as jest.Mocked<IParametersService>;
    const createOrUpdateParametersUseCaseMock = {
        execute: jest.fn(),
    };
    const codeManagementServiceMock = {
        getPullRequestsByRepository: jest.fn(),
        getAllCommentsInPullRequest: jest.fn(),
        getPullRequestReviewComment: jest.fn(),
        getFilesByPullRequestId: jest.fn(),
    };
    const commentAnalysisServiceMock = {
        processComments: jest.fn(),
        generateCodyRules: jest.fn(),
    };
    const sendRulesNotificationUseCaseMock = {
        execute: jest.fn(),
    };

    // Approval enabled → past-review-generated rules land PENDING.
    const codeBaseConfigServiceMock = {
        getSimpleConfig: jest.fn().mockResolvedValue({
            codyKnowledgeApproval: { enabled: true },
        }),
    };

    const findRulesUseCaseMock = {
        execute: jest.fn(),
    };

    const createOrUpdateRuleUseCaseMock = {
        execute: jest.fn(),
    };

    const moduleRefMock = {
        resolve: jest.fn(),
    } as unknown as ModuleRef;

    beforeEach(async () => {
        jest.clearAllMocks();

        codeManagementServiceMock.getPullRequestsByRepository.mockResolvedValue(
            [{ pull_number: 10 }],
        );
        codeManagementServiceMock.getAllCommentsInPullRequest.mockResolvedValue(
            [{ id: 'comment-1' }],
        );
        codeManagementServiceMock.getPullRequestReviewComment.mockResolvedValue(
            [{ id: 'review-comment-1' }],
        );
        codeManagementServiceMock.getFilesByPullRequestId.mockResolvedValue([
            { filename: 'src/a.ts' },
        ]);
        commentAnalysisServiceMock.processComments.mockReturnValue([
            { id: 'processed-1' },
        ]);
        commentAnalysisServiceMock.generateCodyRules.mockResolvedValue([
            {
                title: 'Avoid console.log',
                rule: 'Do not use console.log in production code',
                severity: 'medium',
                origin: 'generated',
                examples: [],
            },
        ]);

        sendRulesNotificationUseCaseMock.execute.mockResolvedValue(undefined);
        createOrUpdateParametersUseCaseMock.execute.mockResolvedValue(
            undefined,
        );

        moduleRefMock.resolve = jest.fn((token: any) => {
            if (token === FindRulesInOrganizationByRuleFilterCodyRulesUseCase) {
                return Promise.resolve(findRulesUseCaseMock);
            }

            if (token === CreateOrUpdateCodyRulesUseCase) {
                return Promise.resolve(createOrUpdateRuleUseCaseMock);
            }

            return Promise.resolve(undefined);
        });

        findRulesUseCaseMock.execute.mockResolvedValue([]);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GenerateCodyRulesUseCase,
                {
                    provide: INTEGRATION_SERVICE_TOKEN,
                    useValue: integrationServiceMock,
                },
                {
                    provide: INTEGRATION_CONFIG_SERVICE_TOKEN,
                    useValue: integrationConfigServiceMock,
                },
                {
                    provide: PARAMETERS_SERVICE_TOKEN,
                    useValue: parametersServiceMock,
                },
                {
                    provide: CreateOrUpdateParametersUseCase,
                    useValue: createOrUpdateParametersUseCaseMock,
                },
                {
                    provide: CodeManagementService,
                    useValue: codeManagementServiceMock,
                },
                {
                    provide: CommentAnalysisService,
                    useValue: commentAnalysisServiceMock,
                },
                {
                    provide: ModuleRef,
                    useValue: moduleRefMock,
                },
                {
                    provide: SendRulesNotificationUseCase,
                    useValue: sendRulesNotificationUseCaseMock,
                },
                {
                    provide: CODE_BASE_CONFIG_SERVICE_TOKEN,
                    useValue: codeBaseConfigServiceMock,
                },
                {
                    provide: PermissionValidationService,
                    useValue: {
                        // Truthy BYOK → model policy resolves to "generate with
                        // BYOK", so these tests exercise the persistence flow.
                        getBYOKConfig: jest
                            .fn()
                            .mockResolvedValue({ main: { model: 'test-model' } }),
                        getSubscriptionStatus: jest
                            .fn()
                            .mockResolvedValue('trial'),
                    },
                },
            ],
        }).compile();

        useCase = module.get(GenerateCodyRulesUseCase);
    });

    it('persists generated rules through centralized-aware create-or-update flow when centralized config is enabled', async () => {
        parametersServiceMock.findByKey.mockImplementation((key: any) => {
            if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                return Promise.resolve({
                    configValue: {
                        repositories: [
                            {
                                id: 'repo-1',
                                name: 'repo-one',
                                isSelected: true,
                                directories: [],
                            },
                        ],
                    },
                });
            }

            if (key === ParametersKey.PLATFORM_CONFIGS) {
                return Promise.resolve({
                    configValue: {
                        codyLearningStatus: 'disabled',
                    },
                });
            }

            return Promise.resolve(null);
        });

        createOrUpdateRuleUseCaseMock.execute.mockResolvedValue({
            mode: 'centralized-pr',
            prUrl: 'https://example.com/pr/1',
            message:
                'Centralized config is enabled. Change proposed through pull request instead of direct persistence.',
        });

        await useCase.execute(
            {
                teamId: 'team-1',
                days: 7,
            } as any,
            'org-1',
        );

        expect(createOrUpdateRuleUseCaseMock.execute).toHaveBeenCalledTimes(1);
        expect(createOrUpdateRuleUseCaseMock.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                status: CodyRulesStatus.PENDING,
                repositoryId: 'repo-1',
            }),
            'org-1',
            expect.objectContaining({ userId: 'cody-system-rules-generator' }),
        );
    });

    it('generates rules ACTIVE when knowledge approval is disabled (policy-driven, no force-activate)', async () => {
        codeBaseConfigServiceMock.getSimpleConfig.mockResolvedValueOnce({
            codyKnowledgeApproval: { enabled: false },
        });
        parametersServiceMock.findByKey.mockImplementation((key: any) => {
            if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                return Promise.resolve({
                    configValue: {
                        repositories: [
                            {
                                id: 'repo-1',
                                name: 'repo-one',
                                isSelected: true,
                                directories: [],
                            },
                        ],
                    },
                });
            }
            if (key === ParametersKey.PLATFORM_CONFIGS) {
                return Promise.resolve({
                    configValue: { codyLearningStatus: 'disabled' },
                });
            }
            return Promise.resolve(null);
        });
        createOrUpdateRuleUseCaseMock.execute.mockResolvedValue({
            uuid: 'rule-1',
        });

        await useCase.execute({ teamId: 'team-1', days: 7 } as any, 'org-1');

        expect(createOrUpdateRuleUseCaseMock.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                status: CodyRulesStatus.ACTIVE,
                repositoryId: 'repo-1',
            }),
            'org-1',
            expect.anything(),
        );
    });

    it('works in direct mode when centralized config is disabled', async () => {
        parametersServiceMock.findByKey.mockImplementation((key: any) => {
            if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                return Promise.resolve({
                    configValue: {
                        repositories: [
                            {
                                id: 'repo-1',
                                name: 'repo-one',
                                isSelected: true,
                                directories: [],
                            },
                        ],
                    },
                });
            }

            if (key === ParametersKey.PLATFORM_CONFIGS) {
                return Promise.resolve({
                    configValue: {
                        codyLearningStatus: 'disabled',
                    },
                });
            }

            return Promise.resolve(null);
        });

        createOrUpdateRuleUseCaseMock.execute.mockResolvedValue({
            uuid: 'rule-uuid-1',
        });

        await useCase.execute(
            {
                teamId: 'team-1',
                days: 7,
            } as any,
            'org-1',
        );

        expect(createOrUpdateRuleUseCaseMock.execute).toHaveBeenCalledTimes(1);
    });

    it('throws (not "200, 0 rules") when PR fetch fails for every repo', async () => {
        parametersServiceMock.findByKey.mockImplementation((key: any) => {
            if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                return Promise.resolve({
                    configValue: {
                        repositories: [
                            {
                                id: 'repo-1',
                                name: 'repo-one',
                                isSelected: true,
                                directories: [],
                            },
                        ],
                    },
                });
            }
            if (key === ParametersKey.PLATFORM_CONFIGS) {
                return Promise.resolve({
                    configValue: { codyLearningStatus: 'enabled' },
                });
            }
            return Promise.resolve(null);
        });

        // null = fetch error (e.g. GitHub App install 404), distinct from [].
        codeManagementServiceMock.getPullRequestsByRepository.mockResolvedValue(
            null,
        );

        await expect(
            useCase.execute({ teamId: 'team-1', months: 3 } as any, 'org-1'),
        ).rejects.toThrow(
            /Could not fetch pull requests from the code management integration/,
        );

        // No rule persisted...
        expect(createOrUpdateRuleUseCaseMock.execute).not.toHaveBeenCalled();
        // ...and codyLearningStatus is reset to ENABLED so the run isn't stuck.
        expect(
            createOrUpdateParametersUseCaseMock.execute,
        ).toHaveBeenCalledWith(
            ParametersKey.PLATFORM_CONFIGS,
            expect.objectContaining({ codyLearningStatus: 'enabled' }),
            expect.anything(),
        );
    });
});
