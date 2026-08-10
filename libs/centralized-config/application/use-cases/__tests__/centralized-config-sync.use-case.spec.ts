import { CentralizedConfigSyncUseCase } from '../centralized-config-sync.use-case';

describe('CentralizedConfigSyncUseCase', () => {
    const organizationAndTeamData = {
        organizationId: 'org-1',
        teamId: 'team-1',
    };

    it('syncs centralized config successfully', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest.fn().mockResolvedValue({
                success: true,
                message: 'Centralized config is valid and enabled',
            }),
            getCentralizedConfigRepository: jest.fn().mockResolvedValue({
                id: 'central-repo-id',
                name: 'codus',
            }),
            discoverConfigFiles: jest.fn().mockResolvedValue([
                {}, // global config
                {
                    repositoryId: 'repo-1-id',
                    centralizedDirectoryPath: 'repo1',
                }, // repo config
            ]),
            discoverCodyRulesFiles: jest.fn().mockResolvedValue([]),
            synchronizeConfigs: jest.fn().mockResolvedValue({
                success: true,
                message: 'Config files synchronized successfully',
            }),
            synchronizeCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Cody rules synchronized successfully',
            }),
            removeStaleConfigs: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale configs removed successfully',
            }),
            removeStaleCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale Cody rules removed successfully',
            }),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(true);
        expect(result.message).toBe(
            'Centralized config sync completed successfully',
        );
        expect(
            centralizedConfigService.validateCentralizedConfig,
        ).toHaveBeenCalledWith({
            organizationAndTeamData,
        });
        expect(
            centralizedConfigService.getCentralizedConfigRepository,
        ).toHaveBeenCalledWith(organizationAndTeamData);
        expect(centralizedConfigService.discoverConfigFiles).toHaveBeenCalled();
        expect(centralizedConfigService.synchronizeConfigs).toHaveBeenCalled();
        expect(centralizedConfigService.removeStaleConfigs).toHaveBeenCalled();
    });

    it('fails when centralized config is not enabled', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest.fn().mockResolvedValue({
                success: false,
                message: 'Centralized config is not enabled for this team',
            }),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            'Centralized config is not enabled for this team',
        );
        expect(
            centralizedConfigService.validateCentralizedConfig,
        ).toHaveBeenCalledWith({
            organizationAndTeamData,
        });
    });

    it('handles errors during sync', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest.fn().mockResolvedValue({
                success: true,
                message: 'Centralized config is valid and enabled',
            }),
            getCentralizedConfigRepository: jest
                .fn()
                .mockRejectedValue(new Error('Repository not found')),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(false);
        expect(result.message).toBe('Error syncing centralized config');
    });

    it('fails when synchronizeConfigs fails', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest.fn().mockResolvedValue({
                success: true,
                message: 'Centralized config is valid and enabled',
            }),
            getCentralizedConfigRepository: jest.fn().mockResolvedValue({
                id: 'central-repo-id',
                name: 'codus',
            }),
            discoverConfigFiles: jest.fn().mockResolvedValue([]),
            discoverCodyRulesFiles: jest.fn().mockResolvedValue([]),
            synchronizeConfigs: jest.fn().mockResolvedValue({
                success: false,
                message: 'Failed to update parameters',
            }),
            synchronizeCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Cody rules synchronized successfully',
            }),
            removeStaleConfigs: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale configs removed successfully',
            }),
            removeStaleCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale Cody rules removed successfully',
            }),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            'Failed to synchronize configs: Failed to update parameters',
        );
        expect(centralizedConfigService.synchronizeConfigs).toHaveBeenCalled();
    });

    it('fails when removeStaleConfigs fails', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest.fn().mockResolvedValue({
                success: true,
                message: 'Centralized config is valid and enabled',
            }),
            getCentralizedConfigRepository: jest.fn().mockResolvedValue({
                id: 'central-repo-id',
                name: 'codus',
            }),
            discoverConfigFiles: jest.fn().mockResolvedValue([]),
            discoverCodyRulesFiles: jest.fn().mockResolvedValue([]),
            synchronizeConfigs: jest.fn().mockResolvedValue({
                success: true,
                message: 'Config files synchronized successfully',
            }),
            synchronizeCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Cody rules synchronized successfully',
            }),
            removeStaleConfigs: jest.fn().mockResolvedValue({
                success: false,
                message: 'Failed to clean up configs',
            }),
            removeStaleCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale Cody rules removed successfully',
            }),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            'Failed to remove stale configs: Failed to clean up configs',
        );
        expect(centralizedConfigService.removeStaleConfigs).toHaveBeenCalled();
    });

    it('merges rule-only scopes into config sync', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest.fn().mockResolvedValue({
                success: true,
                message: 'Centralized config is valid and enabled',
            }),
            getCentralizedConfigRepository: jest.fn().mockResolvedValue({
                id: 'central-repo-id',
                name: 'codus',
            }),
            discoverConfigFiles: jest.fn().mockResolvedValue([
                {},
                {
                    repositoryId: 'repo-1-id',
                    centralizedDirectoryPath: 'repo-1',
                },
            ]),
            discoverCodyRulesFiles: jest.fn().mockResolvedValue([
                {
                    repositoryId: 'repo-1-id',
                    directoryPath: '/src',
                    centralizedDirectoryPath: 'repo-1/src/.cody-rules/review',
                    ruleType: 'standard',
                    ruleFilePath: 'repo-1/src/.cody-rules/review/rule.yml',
                    path: 'repo-1/src/.cody-rules/review/rule.yml',
                },
                {
                    repositoryId: 'repo-1-id',
                    directoryPath: '/src',
                    centralizedDirectoryPath: 'repo-1/src/.cody-rules/memories',
                    ruleType: 'memory',
                    ruleFilePath: 'repo-1/src/.cody-rules/memories/rule.yml',
                    path: 'repo-1/src/.cody-rules/memories/rule.yml',
                },
            ]),
            synchronizeConfigs: jest.fn().mockResolvedValue({
                success: true,
                message: 'Config files synchronized successfully',
            }),
            synchronizeCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Cody rules synchronized successfully',
            }),
            removeStaleConfigs: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale configs removed successfully',
            }),
            removeStaleCodyRules: jest.fn().mockResolvedValue({
                success: true,
                message: 'Stale Cody rules removed successfully',
            }),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(true);
        expect(
            centralizedConfigService.synchronizeConfigs,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                configFiles: [
                    {},
                    {
                        repositoryId: 'repo-1-id',
                        centralizedDirectoryPath: 'repo-1',
                    },
                    {
                        repositoryId: 'repo-1-id',
                        directoryPath: '/src',
                        centralizedDirectoryPath:
                            'repo-1/src/.cody-rules/review',
                    },
                ],
            }),
        );
        expect(
            centralizedConfigService.removeStaleConfigs,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                configFiles: [
                    {},
                    {
                        repositoryId: 'repo-1-id',
                        centralizedDirectoryPath: 'repo-1',
                    },
                    {
                        repositoryId: 'repo-1-id',
                        directoryPath: '/src',
                        centralizedDirectoryPath:
                            'repo-1/src/.cody-rules/review',
                    },
                ],
            }),
        );
    });

    it('aborts before ANY deletion when discovery fails (issue #1518 safety net)', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest
                .fn()
                .mockResolvedValue({ success: true, message: 'ok' }),
            getCentralizedConfigRepository: jest
                .fn()
                .mockResolvedValue({ id: 'central-repo-id', name: 'codus' }),
            discoverConfigFiles: jest.fn().mockResolvedValue([]),
            // A transient read failure now THROWS (scanRepositoryTree) instead
            // of returning [] — the use-case must abort before any removeStale
            // runs, or it would wipe every rule + the org's global config.
            discoverCodyRulesFiles: jest
                .fn()
                .mockRejectedValue(
                    new Error(
                        'repositories integration config unavailable',
                    ),
                ),
            synchronizeConfigs: jest.fn(),
            synchronizeCodyRules: jest.fn(),
            removeStaleConfigs: jest.fn(),
            removeStaleCodyRules: jest.fn(),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(false);
        // The critical safety property: nothing destructive ran.
        expect(
            centralizedConfigService.removeStaleCodyRules,
        ).not.toHaveBeenCalled();
        expect(
            centralizedConfigService.removeStaleConfigs,
        ).not.toHaveBeenCalled();
        expect(
            centralizedConfigService.synchronizeCodyRules,
        ).not.toHaveBeenCalled();
    });

    it('surfaces a partial Cody-rules sync as a failure and skips stale removal (#1518)', async () => {
        const centralizedConfigService = {
            validateCentralizedConfig: jest
                .fn()
                .mockResolvedValue({ success: true, message: 'ok' }),
            getCentralizedConfigRepository: jest
                .fn()
                .mockResolvedValue({ id: 'r', name: 'codus' }),
            discoverConfigFiles: jest.fn().mockResolvedValue([]),
            discoverCodyRulesFiles: jest
                .fn()
                .mockResolvedValue([{ path: 'a.yml' }]),
            synchronizeConfigs: jest
                .fn()
                .mockResolvedValue({ success: true, message: 'ok' }),
            // 27 of 61 materialized, the rest failed — must NOT be success.
            synchronizeCodyRules: jest.fn().mockResolvedValue({
                success: false,
                message: 'Cody rules sync incomplete — synced 27, failed 34',
            }),
            removeStaleConfigs: jest.fn(),
            removeStaleCodyRules: jest.fn(),
        };

        const useCase = new CentralizedConfigSyncUseCase(
            centralizedConfigService as any,
        );

        const result = await useCase.execute({
            organizationAndTeamData,
        } as any);

        expect(result.success).toBe(false);
        expect(result.message).toContain('incomplete');
        // A partial materialization must not trigger stale deletion.
        expect(
            centralizedConfigService.removeStaleCodyRules,
        ).not.toHaveBeenCalled();
        expect(
            centralizedConfigService.removeStaleConfigs,
        ).not.toHaveBeenCalled();
    });
});
