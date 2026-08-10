import { createLogger } from '@libs/core/log/logger';
import { Test, TestingModule } from '@nestjs/testing';
import { CODE_BASE_CONFIG_SERVICE_TOKEN } from '@libs/code-review/domain/contracts/CodeBaseConfigService.contract';
import { IConfigFileMeta } from '@libs/centralized-config/domain/contracts/CentralizedConfigService.contract';
import { ParametersKey } from '@libs/core/domain/enums';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { ConfigLevel } from '@libs/core/infrastructure/config/types/general/pullRequestMessages.type';
import { INTEGRATION_CONFIG_SERVICE_TOKEN } from '@libs/integrations/domain/integrationConfigs/contracts/integration-config.service.contracts';
import { CreateOrUpdateParametersUseCase } from '@libs/organization/application/use-cases/parameters/create-or-update-use-case';
import { PARAMETERS_SERVICE_TOKEN } from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import { CodeManagementService } from '@libs/platform/infrastructure/adapters/services/codeManagement.service';
import { DeleteRepositoryCodeReviewParameterUseCase } from '@libs/code-review/application/use-cases/configuration/delete-repository-code-review-parameter.use-case';
import { UpdateOrCreateCodeReviewParameterUseCase } from '@libs/code-review/application/use-cases/configuration/update-or-create-code-review-parameter-use-case';
import { CreateOrUpdatePullRequestMessagesUseCase } from '@libs/code-review/application/use-cases/pullRequestMessages/create-or-update-pull-request-messages.use-case';
import { PULL_REQUEST_MESSAGES_SERVICE_TOKEN } from '@libs/code-review/domain/pullRequestMessages/contracts/pullRequestMessages.service.contract';
import { CreateOrUpdateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/create-or-update.use-case';
import { DeleteRuleInOrganizationByIdCodyRulesUseCase } from '@libs/codyRules/application/use-cases/delete-rule-in-organization-by-id.use-case';
import { CODY_RULES_SERVICE_TOKEN } from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import * as yaml from 'js-yaml';
import { CentralizedConfigService } from '../centralized-config.service';

describe('CentralizedConfigService', () => {
    let service: CentralizedConfigService;
    let mockParametersService: any;
    let mockIntegrationConfigService: any;
    let mockCodeManagementService: any;
    let mockUpdateOrCreateCodeReviewParameterUseCase: any;
    let mockDeleteRepositoryCodeReviewParameterUseCase: any;
    let mockCreateOrUpdateParametersUseCase: any;
    let mockCreateOrUpdatePullRequestMessagesUseCase: any;
    let mockPullRequestMessagesService: any;
    let mockCodeBaseConfigService: any;
    let mockCreateOrUpdateCodyRulesUseCase: any;
    let mockDeleteRuleInOrganizationByIdCodyRulesUseCase: any;
    let mockCodyRulesService: any;

    const organizationAndTeamData: OrganizationAndTeamData = {
        organizationId: 'org-1',
        teamId: 'team-1',
    };

    const actor = {
        organizationId: 'org-1',
        source: 'sync' as const,
        userEmail: 'cody@kodus.io',
        userId: 'cody',
    };

    beforeEach(async () => {
        mockParametersService = {
            findByKey: jest.fn(),
            findOne: jest.fn(),
        };

        mockIntegrationConfigService = {
            findIntegrationConfigFormatted: jest.fn(),
        };

        mockCodeManagementService = {
            getRepositoryTree: jest.fn(),
            getRepositoryContentFile: jest.fn(),
            getDefaultBranch: jest.fn(),
        };

        mockUpdateOrCreateCodeReviewParameterUseCase = {
            execute: jest.fn(),
        };

        mockDeleteRepositoryCodeReviewParameterUseCase = {
            execute: jest.fn(),
        };

        mockCreateOrUpdateParametersUseCase = {
            execute: jest.fn(),
        };

        mockCreateOrUpdatePullRequestMessagesUseCase = {
            execute: jest.fn(),
        };

        mockPullRequestMessagesService = {
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
        };

        mockCodeBaseConfigService = {
            getCodusConfigFile: jest.fn(),
            getDirectoryIdForPath: jest.fn(),
        };

        mockCreateOrUpdateCodyRulesUseCase = {
            execute: jest.fn(),
        };

        mockDeleteRuleInOrganizationByIdCodyRulesUseCase = {
            execute: jest.fn(),
        };

        mockCodyRulesService = {
            find: jest.fn(),
            findByOrganizationId: jest.fn(),
            updateRulesStatusByFilter: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CentralizedConfigService,
                {
                    provide: PARAMETERS_SERVICE_TOKEN,
                    useValue: mockParametersService,
                },
                {
                    provide: INTEGRATION_CONFIG_SERVICE_TOKEN,
                    useValue: mockIntegrationConfigService,
                },
                {
                    provide: CodeManagementService,
                    useValue: mockCodeManagementService,
                },
                {
                    provide: UpdateOrCreateCodeReviewParameterUseCase,
                    useValue: mockUpdateOrCreateCodeReviewParameterUseCase,
                },
                {
                    provide: DeleteRepositoryCodeReviewParameterUseCase,
                    useValue: mockDeleteRepositoryCodeReviewParameterUseCase,
                },
                {
                    provide: CreateOrUpdateParametersUseCase,
                    useValue: mockCreateOrUpdateParametersUseCase,
                },
                {
                    provide: CreateOrUpdatePullRequestMessagesUseCase,
                    useValue: mockCreateOrUpdatePullRequestMessagesUseCase,
                },
                {
                    provide: PULL_REQUEST_MESSAGES_SERVICE_TOKEN,
                    useValue: mockPullRequestMessagesService,
                },
                {
                    provide: CODE_BASE_CONFIG_SERVICE_TOKEN,
                    useValue: mockCodeBaseConfigService,
                },
                {
                    provide: CreateOrUpdateCodyRulesUseCase,
                    useValue: mockCreateOrUpdateCodyRulesUseCase,
                },
                {
                    provide: DeleteRuleInOrganizationByIdCodyRulesUseCase,
                    useValue: mockDeleteRuleInOrganizationByIdCodyRulesUseCase,
                },
                {
                    provide: CODY_RULES_SERVICE_TOKEN,
                    useValue: mockCodyRulesService,
                },
            ],
        }).compile();

        service = module.get<CentralizedConfigService>(
            CentralizedConfigService,
        );

        // Mock the logger to avoid console output during tests
        jest.spyOn(createLogger(''), 'log').mockImplementation(() => {});
        jest.spyOn(createLogger(''), 'error').mockImplementation(() => {});
        jest.spyOn(createLogger(''), 'warn').mockImplementation(() => {});
    });

    describe('synchronizeConfigs', () => {
        it('should sync custom messages from centralized config', async () => {
            const configFiles: IConfigFileMeta[] = [
                {
                    repositoryId: 'repo-1',
                    centralizedDirectoryPath: 'repo1',
                    directoryPath: '/src',
                },
            ];

            const configFileWithCustomMessages = {
                version: '2.0',
                automatedReviewActive: true,
                customMessages: {
                    globalSettings: {
                        hideComments: false,
                        suggestionCopyPrompt: true,
                    },
                    startReviewMessage: {
                        status: 'every_push',
                        content: 'Custom start message',
                    },
                    endReviewMessage: {
                        status: 'every_push',
                        content: 'Custom end message',
                    },
                },
            };

            // Mock repository lookup
            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [{ id: 'repo-1', name: 'repo1', full_name: 'org/repo1' }],
            );

            // Mock directory ID resolution
            mockCodeBaseConfigService.getDirectoryIdForPath.mockResolvedValue(
                'dir-1',
            );

            // Mock existing parent configs (empty for this test)
            mockPullRequestMessagesService.findOne.mockResolvedValue(null);

            // Mock config file fetch
            mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue(
                configFileWithCustomMessages,
            );

            // Mock parameter operations - different mocks for different keys
            mockParametersService.findByKey.mockImplementation(
                (key, _orgAndTeamData) => {
                    if (key === ParametersKey.CENTRALIZED_CONFIG) {
                        return Promise.resolve({
                            configValue: {
                                enabled: true,
                                repository: {
                                    id: 'centralized-repo-1',
                                    name: 'centralized-repo',
                                },
                            },
                        });
                    }
                    if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                        return Promise.resolve({
                            configValue: {},
                        });
                    }
                    return Promise.resolve({
                        configValue: {},
                    });
                },
            );

            mockUpdateOrCreateCodeReviewParameterUseCase.execute.mockResolvedValue(
                undefined,
            );

            const result = await service.synchronizeConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(
                mockCreateOrUpdatePullRequestMessagesUseCase.execute,
            ).toHaveBeenCalledWith(
                {
                    uuid: 'cody',
                    email: 'cody@kodus.io',
                    organization: { uuid: 'org-1' },
                },
                {
                    organizationId: 'org-1',
                    configLevel: ConfigLevel.DIRECTORY,
                    repositoryId: 'repo-1',
                    directoryId: 'dir-1',
                    startReviewMessage: {
                        status: 'every_push',
                        content: 'Custom start message',
                    },
                    endReviewMessage: {
                        status: 'every_push',
                        content: 'Custom end message',
                    },
                    errorReviewMessage: {
                        status: 'off',
                        content: '',
                    },
                    globalSettings: {
                        hideComments: false,
                        suggestionCopyPrompt: true,
                    },
                },
                {
                    skipAuthorization: true,
                    skipCentralizedPr: true,
                },
            );

            // Verify customMessages are removed from the config stored in Postgres
            expect(
                mockUpdateOrCreateCodeReviewParameterUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    configValue: expect.not.objectContaining({
                        customMessages: expect.anything(),
                    }),
                }),
            );
        });

        it('should handle global config custom messages', async () => {
            const configFiles: IConfigFileMeta[] = [{}]; // Global config

            const configFileWithCustomMessages = {
                version: '2.0',
                automatedReviewActive: true,
                customMessages: {
                    globalSettings: {
                        hideComments: true,
                        suggestionCopyPrompt: false,
                    },
                    startReviewMessage: {
                        status: 'only_when_opened',
                        content: 'Global start message',
                    },
                    endReviewMessage: {
                        status: 'off',
                        content: '',
                    },
                },
            };

            // Mock config file fetch
            mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue(
                configFileWithCustomMessages,
            );

            // Mock parameter operations - different mocks for different keys
            mockParametersService.findByKey.mockImplementation(
                (key, _orgAndTeamData) => {
                    if (key === ParametersKey.CENTRALIZED_CONFIG) {
                        return Promise.resolve({
                            configValue: {
                                enabled: true,
                                repository: {
                                    id: 'centralized-repo-1',
                                    name: 'centralized-repo',
                                },
                            },
                        });
                    }
                    if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                        return Promise.resolve({
                            configValue: {},
                        });
                    }
                    return Promise.resolve({
                        configValue: {},
                    });
                },
            );

            mockUpdateOrCreateCodeReviewParameterUseCase.execute.mockResolvedValue(
                undefined,
            );

            const result = await service.synchronizeConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(
                mockCreateOrUpdatePullRequestMessagesUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.any(Object),
                {
                    organizationId: 'org-1',
                    configLevel: ConfigLevel.GLOBAL,
                    repositoryId: 'global',
                    directoryId: undefined,
                    startReviewMessage: {
                        status: 'only_when_opened',
                        content: 'Global start message',
                    },
                    endReviewMessage: {
                        status: 'off',
                        content: '',
                    },
                    errorReviewMessage: {
                        status: 'off',
                        content: '',
                    },
                    globalSettings: {
                        hideComments: true,
                        suggestionCopyPrompt: false,
                    },
                },
                {
                    skipAuthorization: true,
                    skipCentralizedPr: true,
                },
            );
        });

        it('should sync config file with only custom messages', async () => {
            const configFiles: IConfigFileMeta[] = [{}]; // Global config

            const configFileWithOnlyCustomMessages = {
                customMessages: {
                    globalSettings: {
                        hideComments: false,
                        suggestionCopyPrompt: true,
                    },
                    startReviewMessage: {
                        status: 'every_push',
                        content: 'Custom start message',
                    },
                    endReviewMessage: {
                        status: 'every_push',
                        content: 'Custom end message',
                    },
                },
            };

            // Mock config file fetch
            mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue(
                configFileWithOnlyCustomMessages,
            );

            // Mock parameter operations - different mocks for different keys
            mockParametersService.findByKey.mockImplementation(
                (key, _orgAndTeamData) => {
                    if (key === ParametersKey.CENTRALIZED_CONFIG) {
                        return Promise.resolve({
                            configValue: {
                                enabled: true,
                                repository: {
                                    id: 'centralized-repo-1',
                                    name: 'centralized-repo',
                                },
                            },
                        });
                    }
                    if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                        return Promise.resolve({
                            configValue: {},
                        });
                    }
                    return Promise.resolve({
                        configValue: {},
                    });
                },
            );

            mockUpdateOrCreateCodeReviewParameterUseCase.execute.mockResolvedValue(
                undefined,
            );

            const result = await service.synchronizeConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(
                mockCreateOrUpdatePullRequestMessagesUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.any(Object),
                {
                    organizationId: 'org-1',
                    configLevel: ConfigLevel.GLOBAL,
                    repositoryId: 'global',
                    directoryId: undefined,
                    startReviewMessage: {
                        status: 'every_push',
                        content: 'Custom start message',
                    },
                    endReviewMessage: {
                        status: 'every_push',
                        content: 'Custom end message',
                    },
                    errorReviewMessage: {
                        status: 'off',
                        content: '',
                    },
                    globalSettings: {
                        hideComments: false,
                        suggestionCopyPrompt: true,
                    },
                },
                {
                    skipAuthorization: true,
                    skipCentralizedPr: true,
                },
            );

            // Verify that customMessages are removed and only an empty config is stored in Postgres
            expect(
                mockUpdateOrCreateCodeReviewParameterUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    configValue: {},
                }),
            );
        });

        it('should skip custom messages sync when customMessages is not present', async () => {
            const configFiles: IConfigFileMeta[] = [{}];

            const configFileWithoutCustomMessages = {
                version: '2.0',
                automatedReviewActive: true,
            };

            // Mock config file fetch
            mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue(
                configFileWithoutCustomMessages,
            );

            // Mock parameter operations - different mocks for different keys
            mockParametersService.findByKey.mockImplementation(
                (key, _orgAndTeamData) => {
                    if (key === ParametersKey.CENTRALIZED_CONFIG) {
                        return Promise.resolve({
                            configValue: {
                                enabled: true,
                                repository: {
                                    id: 'centralized-repo-1',
                                    name: 'centralized-repo',
                                },
                            },
                        });
                    }
                    if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                        return Promise.resolve({
                            configValue: {},
                        });
                    }
                    return Promise.resolve({
                        configValue: {},
                    });
                },
            );

            mockUpdateOrCreateCodeReviewParameterUseCase.execute.mockResolvedValue(
                undefined,
            );

            const result = await service.synchronizeConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(
                mockCreateOrUpdatePullRequestMessagesUseCase.execute,
            ).not.toHaveBeenCalled();
        });

        it('should handle errors in custom messages sync gracefully', async () => {
            const configFiles: IConfigFileMeta[] = [{}];

            const configFileWithCustomMessages = {
                version: '2.0',
                automatedReviewActive: true,
                customMessages: {
                    globalSettings: {
                        hideComments: false,
                        suggestionCopyPrompt: true,
                    },
                    startReviewMessage: {
                        status: 'every_push',
                        content: 'Custom start message',
                    },
                    endReviewMessage: {
                        status: 'every_push',
                        content: 'Custom end message',
                    },
                },
            };

            // Mock config file fetch
            mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue(
                configFileWithCustomMessages,
            );

            // Mock parameter operations - different mocks for different keys
            mockParametersService.findByKey.mockImplementation(
                (key, _orgAndTeamData) => {
                    if (key === ParametersKey.CENTRALIZED_CONFIG) {
                        return Promise.resolve({
                            configValue: {
                                enabled: true,
                                repository: {
                                    id: 'centralized-repo-1',
                                    name: 'centralized-repo',
                                },
                            },
                        });
                    }
                    if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                        return Promise.resolve({
                            configValue: {},
                        });
                    }
                    return Promise.resolve({
                        configValue: {},
                    });
                },
            );

            mockUpdateOrCreateCodeReviewParameterUseCase.execute.mockResolvedValue(
                undefined,
            );

            // Mock custom messages sync to fail
            mockCreateOrUpdatePullRequestMessagesUseCase.execute.mockRejectedValue(
                new Error('Custom messages sync failed'),
            );

            const result = await service.synchronizeConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            // Should still succeed because custom messages errors don't fail the whole sync
            expect(result.success).toBe(true);
            expect(result.message).toBe(
                'Config files synchronized successfully',
            );
        });

        it('should create empty config placeholders for rule-only scopes', async () => {
            const configFiles: IConfigFileMeta[] = [
                {
                    repositoryId: 'repo-1',
                    directoryPath: '/src',
                    centralizedDirectoryPath: 'repo-1/src/.cody-rules/review',
                },
            ];

            mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue(
                null,
            );

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [{ id: 'repo-1', name: 'repo-1', full_name: 'org/repo-1' }],
            );

            mockCodeBaseConfigService.getDirectoryIdForPath.mockResolvedValue(
                'dir-1',
            );

            mockPullRequestMessagesService.findOne.mockResolvedValue({
                uuid: 'message-1',
            });

            mockParametersService.findByKey.mockImplementation((key) => {
                if (key === ParametersKey.CENTRALIZED_CONFIG) {
                    return Promise.resolve({
                        configValue: {
                            enabled: true,
                            repository: {
                                id: 'centralized-repo-1',
                                name: 'centralized-repo',
                            },
                        },
                    });
                }

                if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                    return Promise.resolve({
                        configValue: {},
                    });
                }

                return Promise.resolve({
                    configValue: {},
                });
            });

            mockUpdateOrCreateCodeReviewParameterUseCase.execute.mockResolvedValue(
                undefined,
            );

            const result = await service.synchronizeConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(
                mockUpdateOrCreateCodeReviewParameterUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    configValue: {},
                    repositoryId: 'repo-1',
                    directoryPath: '/src',
                }),
            );
            expect(
                mockCreateOrUpdatePullRequestMessagesUseCase.execute,
            ).not.toHaveBeenCalled();
            expect(mockPullRequestMessagesService.delete).toHaveBeenCalledWith(
                'message-1',
            );
        });
    });

    describe('removeStaleConfigs', () => {
        it('should remove stale custom messages even when regular config does not change', async () => {
            // Non-empty discovery (a repo scope) so the #1518 empty-discovery
            // guard does not trigger; the GLOBAL message is stale because no
            // global config file was discovered.
            const configFiles: IConfigFileMeta[] = [
                { repositoryId: 'repo-1' } as any,
            ];

            const codeReviewConfig = {
                configValue: {
                    configs: {},
                    repositories: [],
                },
            };

            mockParametersService.findByKey.mockImplementation((key) => {
                if (key === ParametersKey.CODE_REVIEW_CONFIG) {
                    return Promise.resolve(codeReviewConfig);
                }

                return Promise.resolve({ configValue: {} });
            });

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [],
            );

            mockPullRequestMessagesService.find.mockResolvedValue([
                {
                    uuid: 'global-message-1',
                    configLevel: ConfigLevel.GLOBAL,
                },
            ]);

            const result = await service.removeStaleConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(result.message).toBe('No stale configs to remove');
            expect(mockPullRequestMessagesService.delete).toHaveBeenCalledWith(
                'global-message-1',
            );
            expect(
                mockCreateOrUpdateParametersUseCase.execute,
            ).not.toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------------
    // Issue #1518 — empty/failed discovery must NOT wipe data. A read failure
    // (repositories mapping unavailable, tree read failed) yields the same
    // empty result as a genuinely empty repo, and the non-transactional
    // reconcile then deleted every rule and reset the org's global config
    // (default model / BYOK) plus custom messages. These assert the SAFE
    // post-guard behavior and are the regression coverage for the fix.
    // ---------------------------------------------------------------------
    describe('#1518 empty-discovery wipe guard', () => {
        it('discoverCodyRulesFiles THROWS (not []) when the repositories mapping cannot be loaded', async () => {
            mockCodeManagementService.getRepositoryTree.mockResolvedValue([
                { type: 'file', path: 'my-repo/.cody-rules/review/a.yml' },
            ]);
            // Transient integration-config read failure → null (a FAILURE, not
            // "zero files"). Must surface so the sync aborts before deletion.
            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                null,
            );

            await expect(
                service.discoverCodyRulesFiles({
                    organizationAndTeamData,
                    repository: { name: 'config-repo', id: 'repo-1' },
                }),
            ).rejects.toThrow();
        });

        it('discoverConfigFiles THROWS (not []) when the repositories mapping cannot be loaded', async () => {
            // Twin of discoverCodyRulesFiles — both go through scanRepositoryTree,
            // and both feed removeStale*, so both must fail loudly on a read error.
            mockCodeManagementService.getRepositoryTree.mockResolvedValue([
                { type: 'file', path: 'my-repo/codus-config.yml' },
            ]);
            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                null,
            );

            await expect(
                service.discoverConfigFiles({
                    organizationAndTeamData,
                    repository: { name: 'config-repo', id: 'repo-1' },
                }),
            ).rejects.toThrow();
        });

        it('removeStaleCodyRules does NOT delete centralized rules when discovery is empty', async () => {
            const ruleFiles: any[] = []; // empty discovery

            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                toJson: () => ({
                    rules: [
                        {
                            uuid: 'r1',
                            title: 'A',
                            centralizedConfig: {
                                path: '.cody-rules/review/a.yml',
                            },
                        },
                        {
                            uuid: 'r2',
                            title: 'B',
                            centralizedConfig: {
                                path: '.cody-rules/review/b.yml',
                            },
                        },
                    ],
                }),
            });

            const result = await service.removeStaleCodyRules({
                organizationAndTeamData,
                ruleFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(result.removedRuleCount).toBe(0);
            expect(
                mockDeleteRuleInOrganizationByIdCodyRulesUseCase.execute,
            ).not.toHaveBeenCalled();
        });

        it('removeStaleConfigs does NOT reset global config / delete repo configs / delete messages when discovery is empty', async () => {
            const configFiles: IConfigFileMeta[] = []; // empty discovery

            const codeReviewConfig = {
                configValue: {
                    // org-wide defaults: LLM provider + model + BYOK reference
                    configs: {
                        llmProvider: 'openai_byok',
                        byokConfig: { apiKey: 'sk-live-secret' },
                    },
                    repositories: [
                        {
                            id: 'repo-1',
                            isSelected: true,
                            configs: { reviewOptions: { security: true } },
                            directories: [],
                        },
                    ],
                },
            };

            mockParametersService.findByKey.mockImplementation((key: any) =>
                key === ParametersKey.CODE_REVIEW_CONFIG
                    ? Promise.resolve(codeReviewConfig)
                    : Promise.resolve({ configValue: {} }),
            );
            mockPullRequestMessagesService.find.mockResolvedValue([
                { uuid: 'global-message-1', configLevel: ConfigLevel.GLOBAL },
            ]);

            const result = await service.removeStaleConfigs({
                organizationAndTeamData,
                configFiles,
                actor,
            });

            expect(result.success).toBe(true);
            // None of the destructive paths may fire on empty discovery.
            expect(
                mockCreateOrUpdateParametersUseCase.execute,
            ).not.toHaveBeenCalled();
            expect(
                mockDeleteRepositoryCodeReviewParameterUseCase.execute,
            ).not.toHaveBeenCalled();
            expect(
                mockPullRequestMessagesService.delete,
            ).not.toHaveBeenCalled();
        });
    });

    // Backfill for the four methods that had no direct unit test — the gap
    // that let #1518 through (methods only exercised via mocks in the use-case
    // spec, never their own logic).
    describe('untested method coverage', () => {
        describe('validateCentralizedConfig', () => {
            it('fails when centralized config is not enabled', async () => {
                mockParametersService.findByKey.mockResolvedValue({
                    configValue: { enabled: false },
                });
                const r = await service.validateCentralizedConfig({
                    organizationAndTeamData,
                });
                expect(r.success).toBe(false);
                expect(r.message).toContain('not enabled');
            });

            it('fails when enabled but no repository is configured', async () => {
                mockParametersService.findByKey.mockResolvedValue({
                    configValue: { enabled: true, repository: {} },
                });
                const r = await service.validateCentralizedConfig({
                    organizationAndTeamData,
                });
                expect(r.success).toBe(false);
                expect(r.message).toContain('no repository');
            });

            it('succeeds when enabled and a repository is configured', async () => {
                mockParametersService.findByKey.mockResolvedValue({
                    configValue: {
                        enabled: true,
                        repository: { id: 'r1', name: 'codus' },
                    },
                });
                const r = await service.validateCentralizedConfig({
                    organizationAndTeamData,
                });
                expect(r.success).toBe(true);
            });
        });

        describe('getCentralizedConfigRepository', () => {
            it('returns the configured repository', async () => {
                mockParametersService.findByKey.mockResolvedValue({
                    configValue: { repository: { id: 'r1', name: 'codus' } },
                });
                const repo =
                    await service.getCentralizedConfigRepository(
                        organizationAndTeamData,
                    );
                expect(repo).toEqual({ id: 'r1', name: 'codus' });
            });

            it('throws when no repository is configured', async () => {
                mockParametersService.findByKey.mockResolvedValue({
                    configValue: {},
                });
                await expect(
                    service.getCentralizedConfigRepository(
                        organizationAndTeamData,
                    ),
                ).rejects.toThrow(
                    'Centralized config repository not configured',
                );
            });
        });

        describe('fetchConfigFile', () => {
            it('returns the config file on success', async () => {
                mockCodeBaseConfigService.getCodusConfigFile.mockResolvedValue({
                    version: 2,
                });
                const file = await service.fetchConfigFile({
                    organizationAndTeamData,
                    repository: { name: 'r', id: 'r1' },
                });
                expect(file).toEqual({ version: 2 });
            });

            it('returns null (does not throw) when the read fails', async () => {
                mockCodeBaseConfigService.getCodusConfigFile.mockRejectedValue(
                    new Error('boom'),
                );
                const file = await service.fetchConfigFile({
                    organizationAndTeamData,
                    repository: { name: 'r', id: 'r1' },
                });
                expect(file).toBeNull();
            });
        });

        describe('fetchCodyRuleFile', () => {
            it('returns null when the file has no content', async () => {
                mockCodeManagementService.getDefaultBranch.mockResolvedValue(
                    'main',
                );
                mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                    { data: {} },
                );
                const rule = await service.fetchCodyRuleFile({
                    organizationAndTeamData,
                    repository: { name: 'r', id: 'r1' },
                    filePath: '.cody-rules/review/a.yml',
                });
                expect(rule).toBeNull();
            });

            it('decodes and parses a base64 YAML rule file', async () => {
                mockCodeManagementService.getDefaultBranch.mockResolvedValue(
                    'main',
                );
                const yamlContent = 'title: My rule\nrule: do the thing\n';
                mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                    {
                        data: {
                            content: Buffer.from(
                                yamlContent,
                                'utf-8',
                            ).toString('base64'),
                            encoding: 'base64',
                        },
                    },
                );
                const rule = await service.fetchCodyRuleFile({
                    organizationAndTeamData,
                    repository: { name: 'r', id: 'r1' },
                    filePath: '.cody-rules/review/a.yml',
                });
                expect(rule).toMatchObject({ title: 'My rule' });
            });
        });
    });

    describe('discoverCodyRulesFiles', () => {
        it('should discover Cody rule files from centralized repository', async () => {
            const mockRepoTree = [
                {
                    path: 'codus-config.yml',
                    type: 'file' as const,
                },
                {
                    path: '.cody-rules/memories/logging.yml',
                    type: 'file' as const,
                },
                {
                    path: '.cody-rules/review/security.yml',
                    type: 'file' as const,
                },
                {
                    path: 'org-a/.cody-rules/memories/auth.yml',
                    type: 'file' as const,
                },
                {
                    path: 'org-a/services%2Fapi/.cody-rules/review/api.yml',
                    type: 'file' as const,
                },
            ];

            mockCodeManagementService.getRepositoryTree.mockResolvedValue(
                mockRepoTree,
            );

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [{ id: 'org-a-id', name: 'org-a', full_name: 'org-a' }],
            );

            const result = await service.discoverCodyRulesFiles({
                organizationAndTeamData,
                repository: { name: 'central-repo', id: 'central-repo-id' },
            });

            expect(result).toHaveLength(4);
            expect(result).toEqual(
                expect.arrayContaining([
                    {
                        centralizedDirectoryPath: '.cody-rules/memories',
                        repositoryId: undefined,
                        directoryPath: undefined,
                        directoryPaths: undefined,
                        ruleType: 'memory' as any,
                        ruleFilePath: '.cody-rules/memories/logging.yml',
                        path: '.cody-rules/memories/logging.yml',
                    },
                    {
                        centralizedDirectoryPath: '.cody-rules/review',
                        repositoryId: undefined,
                        directoryPath: undefined,
                        directoryPaths: undefined,
                        ruleType: 'standard' as any,
                        ruleFilePath: '.cody-rules/review/security.yml',
                        path: '.cody-rules/review/security.yml',
                    },
                    {
                        centralizedDirectoryPath: 'org-a/.cody-rules/memories',
                        repositoryId: 'org-a-id',
                        directoryPath: undefined,
                        directoryPaths: undefined,
                        ruleType: 'memory' as any,
                        ruleFilePath: 'org-a/.cody-rules/memories/auth.yml',
                        path: 'org-a/.cody-rules/memories/auth.yml',
                    },
                    {
                        centralizedDirectoryPath:
                            'org-a/services%2Fapi/.cody-rules/review',
                        repositoryId: 'org-a-id',
                        directoryPath: '/services/api',
                        directoryPaths: ['/services/api'],
                        ruleType: 'standard' as any,
                        ruleFilePath:
                            'org-a/services%2Fapi/.cody-rules/review/api.yml',
                        path: 'org-a/services%2Fapi/.cody-rules/review/api.yml',
                    },
                ]),
            );
        });

        it('should exclude files not in .cody-rules directories', async () => {
            const mockRepoTree = [
                {
                    path: 'codus-config.yml',
                    type: 'file' as const,
                },
                {
                    path: 'rules.yml',
                    type: 'file' as const,
                },
                {
                    path: '.cody-rules/memories/logging.yml',
                    type: 'file' as const,
                },
            ];

            mockCodeManagementService.getRepositoryTree.mockResolvedValue(
                mockRepoTree,
            );

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [],
            );

            const result = await service.discoverCodyRulesFiles({
                organizationAndTeamData,
                repository: { name: 'central-repo', id: 'central-repo-id' },
            });

            expect(result).toHaveLength(1);
            expect(result[0].ruleFilePath).toBe(
                '.cody-rules/memories/logging.yml',
            );
        });
    });

    describe('synchronizeCodyRules', () => {
        it('should synchronize Cody rules successfully', async () => {
            const ruleFiles: any[] = [
                {
                    centralizedDirectoryPath: '.cody-rules/memories',
                    repositoryId: undefined,
                    directoryPath: undefined,
                    ruleType: 'memory' as any,
                    ruleFilePath: '.cody-rules/memories/logging.yml',
                    path: '.cody-rules/memories/logging.yml',
                },
            ];

            const mockRuleContent = {
                title: 'Logging Rule',
                rule: 'Use structured logging',
                examples: [
                    { snippet: 'console.log("test")', isCorrect: false },
                ],
                inheritance: { inheritable: true, exclude: [], include: [] },
            };

            mockCodeManagementService.getRepositoryTree.mockResolvedValue([]);
            mockCodeManagementService.getDefaultBranch.mockResolvedValue(
                'main',
            );
            mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                {
                    data: {
                        content: Buffer.from(
                            yaml.dump(mockRuleContent),
                        ).toString('base64'),
                        encoding: 'base64',
                    },
                },
            );

            mockParametersService.findByKey.mockResolvedValue({
                configValue: {
                    repository: { name: 'central-repo', id: 'central-repo-id' },
                },
            });

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [],
            );
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                rules: [],
            });
            mockCreateOrUpdateCodyRulesUseCase.execute.mockResolvedValue({
                uuid: 'rule-uuid',
            });

            const result = await service.synchronizeCodyRules({
                organizationAndTeamData,
                ruleFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain(
                'Cody rules synchronized successfully',
            );
            expect(result.syncedRuleCount).toBe(1);
            expect(
                mockCreateOrUpdateCodyRulesUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Logging Rule',
                    rule: 'Use structured logging',
                    type: 'memory',
                    status: 'active',
                    repositoryId: 'global',
                    centralizedConfig: {
                        path: '.cody-rules/memories/logging.yml',
                        status: 'synced',
                    },
                }),
                'org-1',
                expect.any(Object),
                true,
            );
        });

        it('should update existing pending rule when sourcePath matches', async () => {
            const ruleFiles: any[] = [
                {
                    centralizedDirectoryPath: '.cody-rules/review',
                    repositoryId: undefined,
                    directoryPath: undefined,
                    ruleType: 'standard' as any,
                    ruleFilePath: '.cody-rules/review/security.yml',
                    path: '.cody-rules/review/security.yml',
                },
            ];

            const mockRuleContent = {
                title: 'Security Rule',
                rule: 'Never expose secrets',
                examples: [],
                inheritance: { inheritable: true, exclude: [], include: [] },
            };

            mockCodeManagementService.getRepositoryTree.mockResolvedValue([]);
            mockCodeManagementService.getDefaultBranch.mockResolvedValue(
                'main',
            );
            mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                {
                    data: {
                        content: Buffer.from(
                            yaml.dump(mockRuleContent),
                        ).toString('base64'),
                        encoding: 'base64',
                    },
                },
            );

            mockParametersService.findByKey.mockResolvedValue({
                configValue: {
                    repository: { name: 'central-repo', id: 'central-repo-id' },
                },
            });

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [],
            );
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                rules: [
                    {
                        uuid: 'pending-rule-uuid',
                        status: 'pending',
                        origin: 'past_reviews',
                        centralizedConfig: {
                            path: '.cody-rules/review/security.yml',
                            status: 'pending_edit',
                        },
                    },
                ],
            });
            mockCreateOrUpdateCodyRulesUseCase.execute.mockResolvedValue({
                uuid: 'pending-rule-uuid',
            });

            const result = await service.synchronizeCodyRules({
                organizationAndTeamData,
                ruleFiles,
                actor,
            });

            expect(result.success).toBe(true);
            // Sync must NOT auto-approve a rule that is awaiting approval, and
            // must not reclassify its origin — otherwise merging the
            // centralized-config PR silently approves every pending rule.
            expect(
                mockCreateOrUpdateCodyRulesUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    uuid: 'pending-rule-uuid',
                    centralizedConfig: {
                        path: '.cody-rules/review/security.yml',
                        status: 'synced',
                    },
                    status: 'pending',
                    origin: 'past_reviews',
                }),
                'org-1',
                expect.any(Object),
                true,
            );
        });

        it('should NOT resurrect a rejected rule when sourcePath matches', async () => {
            const ruleFiles: any[] = [
                {
                    centralizedDirectoryPath: '.cody-rules/review',
                    repositoryId: undefined,
                    directoryPath: undefined,
                    ruleType: 'standard' as any,
                    ruleFilePath: '.cody-rules/review/rejected.yml',
                    path: '.cody-rules/review/rejected.yml',
                },
            ];

            const mockRuleContent = {
                title: 'Rejected Rule',
                rule: 'Should stay hidden',
                examples: [],
                inheritance: { inheritable: true, exclude: [], include: [] },
            };

            mockCodeManagementService.getRepositoryTree.mockResolvedValue([]);
            mockCodeManagementService.getDefaultBranch.mockResolvedValue(
                'main',
            );
            mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                {
                    data: {
                        content: Buffer.from(
                            yaml.dump(mockRuleContent),
                        ).toString('base64'),
                        encoding: 'base64',
                    },
                },
            );

            mockParametersService.findByKey.mockResolvedValue({
                configValue: {
                    repository: { name: 'central-repo', id: 'central-repo-id' },
                },
            });

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [],
            );
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                rules: [
                    {
                        uuid: 'rejected-rule-uuid',
                        status: 'rejected',
                        centralizedConfig: {
                            path: '.cody-rules/review/rejected.yml',
                            status: 'synced',
                        },
                    },
                ],
            });
            mockCreateOrUpdateCodyRulesUseCase.execute.mockResolvedValue({
                uuid: 'rejected-rule-uuid',
            });

            await service.synchronizeCodyRules({
                organizationAndTeamData,
                ruleFiles,
                actor,
            });

            expect(
                mockCreateOrUpdateCodyRulesUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    uuid: 'rejected-rule-uuid',
                    status: 'rejected',
                }),
                'org-1',
                expect.any(Object),
                true,
            );
        });

        it('should update existing active rule when sourcePath matches', async () => {
            const ruleFiles: any[] = [
                {
                    centralizedDirectoryPath: '.cody-rules/review',
                    repositoryId: undefined,
                    directoryPath: undefined,
                    ruleType: 'standard' as any,
                    ruleFilePath: '.cody-rules/review/style.yml',
                    path: '.cody-rules/review/style.yml',
                },
            ];

            const mockRuleContent = {
                title: 'Style Rule',
                rule: 'Prefer const over let',
                examples: [],
                inheritance: { inheritable: true, exclude: [], include: [] },
            };

            mockCodeManagementService.getRepositoryTree.mockResolvedValue([]);
            mockCodeManagementService.getDefaultBranch.mockResolvedValue(
                'main',
            );
            mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                {
                    data: {
                        content: Buffer.from(
                            yaml.dump(mockRuleContent),
                        ).toString('base64'),
                        encoding: 'base64',
                    },
                },
            );

            mockParametersService.findByKey.mockResolvedValue({
                configValue: {
                    repository: { name: 'central-repo', id: 'central-repo-id' },
                },
            });

            mockIntegrationConfigService.findIntegrationConfigFormatted.mockResolvedValue(
                [],
            );
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                rules: [
                    {
                        uuid: 'active-rule-uuid',
                        status: 'active',
                        centralizedConfig: {
                            path: '.cody-rules/review/style.yml',
                            status: 'synced',
                        },
                    },
                ],
            });
            mockCreateOrUpdateCodyRulesUseCase.execute.mockResolvedValue({
                uuid: 'active-rule-uuid',
            });

            const result = await service.synchronizeCodyRules({
                organizationAndTeamData,
                ruleFiles,
                actor,
            });

            expect(result.success).toBe(true);
            expect(
                mockCreateOrUpdateCodyRulesUseCase.execute,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    uuid: 'active-rule-uuid',
                    centralizedConfig: {
                        path: '.cody-rules/review/style.yml',
                        status: 'synced',
                    },
                    status: 'active',
                }),
                'org-1',
                expect.any(Object),
                true,
            );
        });

        it('should handle YAML parsing errors gracefully', async () => {
            const ruleFiles: any[] = [
                {
                    centralizedDirectoryPath: '.cody-rules/memories',
                    ruleFilePath: '.cody-rules/memories/invalid.yml',
                    path: '.cody-rules/memories/invalid.yml',
                    ruleType: 'memory' as any,
                },
            ];

            mockParametersService.findByKey.mockResolvedValue({
                configValue: {
                    repository: { name: 'central-repo', id: 'central-repo-id' },
                },
            });
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                rules: [],
            });

            mockCodeManagementService.getRepositoryContentFile.mockResolvedValue(
                {
                    data: {
                        content: Buffer.from('invalid: yaml: content: ['), // Invalid YAML
                        encoding: 'base64',
                    },
                },
            );

            const result = await service.synchronizeCodyRules({
                organizationAndTeamData,
                ruleFiles,
                actor,
            });

            // #1518: a per-file failure must NOT be reported as an overall
            // success — the sync is incomplete and the caller has to know.
            expect(result.success).toBe(false);
            expect(result.message).toContain('incomplete');
            expect(result.failureDetails).toHaveLength(1);
            expect(result.failureDetails![0].file).toBe(
                '.cody-rules/memories/invalid.yml',
            );
        });
    });

    describe('removeStaleCodyRules', () => {
        it('should remove stale centralized rules not present in centralized files', async () => {
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                toJson: () => ({
                    rules: [
                        {
                            uuid: 'pending-merge-rule-1',
                            title: 'Pending merge rule',
                            status: 'active',
                            centralizedConfig: {
                                path: '.cody-rules/review/pending.yml',
                                status: 'pending_delete',
                            },
                        },
                    ],
                }),
            });

            mockDeleteRuleInOrganizationByIdCodyRulesUseCase.execute.mockResolvedValue(
                true,
            );

            const result = await service.removeStaleCodyRules({
                organizationAndTeamData,
                actor,
                // Non-empty discovery (a real file list that just doesn't
                // include pending.yml) so the #1518 empty-discovery guard does
                // not trigger — this validates genuine stale removal.
                ruleFiles: [
                    { path: '.cody-rules/review/other.yml' } as any,
                ],
            });

            expect(result.success).toBe(true);
            expect(
                mockDeleteRuleInOrganizationByIdCodyRulesUseCase.execute,
            ).toHaveBeenCalledWith('pending-merge-rule-1', actor);
        });

        it('should NOT delete rules that were never part of the centralized config', async () => {
            // Pending/rejected/manual rules have no centralizedConfig.path —
            // they aren't exported, so the stale-cleanup must leave them alone
            // instead of treating a missing path as "stale".
            mockCodyRulesService.findByOrganizationId.mockResolvedValue({
                toJson: () => ({
                    rules: [
                        { uuid: 'pending-rule', status: 'pending' },
                        { uuid: 'rejected-rule', status: 'rejected' },
                        {
                            uuid: 'manual-rule',
                            status: 'active',
                            centralizedConfig: null,
                        },
                        {
                            uuid: 'synced-rule',
                            status: 'active',
                            centralizedConfig: {
                                path: '.cody-rules/review/kept.yml',
                                status: 'synced',
                            },
                        },
                    ],
                }),
            });

            mockDeleteRuleInOrganizationByIdCodyRulesUseCase.execute.mockResolvedValue(
                true,
            );

            const result = await service.removeStaleCodyRules({
                organizationAndTeamData,
                actor,
                ruleFiles: [
                    { path: '.cody-rules/review/kept.yml' } as any,
                ],
            });

            expect(result.success).toBe(true);
            // The synced rule is still present in the files → not deleted.
            // None of the path-less rules are deleted either.
            expect(
                mockDeleteRuleInOrganizationByIdCodyRulesUseCase.execute,
            ).not.toHaveBeenCalled();
        });
    });
});
