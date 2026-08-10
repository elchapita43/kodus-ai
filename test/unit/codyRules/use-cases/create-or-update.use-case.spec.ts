import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ContextReferenceDetectionService } from '@libs/ai-engine/infrastructure/adapters/services/context/context-reference-detection.service';
import {
    CONTEXT_RESOLUTION_SERVICE_TOKEN,
    IContextResolutionService,
} from '@libs/core/context-resolution/domain/contracts/context-resolution.service.contract';
import {
    CentralizedConfigPrService,
    CentralizedPrMetadata,
} from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';
import { PermissionValidationService } from '@libs/ee/shared/services/permissionValidation.service';
import { CODY_RULE_DETECTOR_COMPILER_TOKEN } from '@libs/codyRules/domain/contracts/cody-rule-detector-compiler.contract';
import { CreateOrUpdateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/create-or-update.use-case';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    CodyRuleCentralizedStatus,
    CodyRulesOrigin,
    CodyRulesScope,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

jest.mock('@libs/core/log/logger', () => ({
    createLogger: () => ({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }),
}));

describe('CreateOrUpdateCodyRulesUseCase (centralized pending states)', () => {
    let useCase: CreateOrUpdateCodyRulesUseCase;
    let codyRulesServiceMock: jest.Mocked<ICodyRulesService>;
    let centralizedConfigPrServiceMock: {
        createMutationPullRequestIfEnabled: jest.Mock;
        getCentralizedRepositoryIfEnabled: jest.Mock;
        resolveRepositoryFolderName: jest.Mock;
        resolveDirectoryGroupFolderName: jest.Mock;
        buildCentralizedPath: jest.Mock;
        sanitizeFileName: jest.Mock;
        buildRuleFileName: jest.Mock;
    };

    beforeEach(async () => {
        codyRulesServiceMock = {
            createOrUpdate: jest.fn(),
            findById: jest.fn(),
            updateRuleReferences: jest.fn(),
        } as unknown as jest.Mocked<ICodyRulesService>;

        centralizedConfigPrServiceMock = {
            createMutationPullRequestIfEnabled: jest.fn(),
            getCentralizedRepositoryIfEnabled: jest.fn(),
            resolveRepositoryFolderName: jest.fn(),
            resolveDirectoryGroupFolderName: jest
                .fn()
                .mockResolvedValue(null),
            buildCentralizedPath: jest.fn(),
            sanitizeFileName: jest.fn(),
            buildRuleFileName: jest.fn(
                (title?: string, uuid?: string) =>
                    `${centralizedConfigPrServiceMock.sanitizeFileName(
                        title,
                        'rule',
                    )}${uuid ? `-${String(uuid).slice(0, 8)}` : ''}.yml`,
            ),
        };

        centralizedConfigPrServiceMock.getCentralizedRepositoryIfEnabled.mockResolvedValue(
            null,
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateOrUpdateCodyRulesUseCase,
                {
                    provide: CODY_RULES_SERVICE_TOKEN,
                    useValue: codyRulesServiceMock,
                },
                {
                    provide: CONTEXT_RESOLUTION_SERVICE_TOKEN,
                    useValue: {
                        getTeamIdByOrganizationAndRepository: jest.fn(),
                        getRepositoryNameByOrganizationAndRepository: jest.fn(),
                    } as Partial<IContextResolutionService>,
                },
                {
                    provide: AuthorizationService,
                    useValue: {
                        ensure: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: ContextReferenceDetectionService,
                    useValue: {
                        detectAndSaveReferences: jest.fn(),
                    },
                },
                {
                    provide: CentralizedConfigPrService,
                    useValue: centralizedConfigPrServiceMock,
                },
                {
                    provide: PermissionValidationService,
                    useValue: {
                        getBYOKConfig: jest.fn().mockResolvedValue(null),
                        getSubscriptionStatus: jest
                            .fn()
                            .mockResolvedValue(undefined),
                    },
                },
                {
                    provide: CODY_RULE_DETECTOR_COMPILER_TOKEN,
                    useValue: {
                        compileAndSave: jest
                            .fn()
                            .mockResolvedValue(undefined),
                    },
                },
                {
                    provide: REQUEST,
                    useValue: {
                        user: {
                            organization: { uuid: 'org-1' },
                            team: { uuid: 'team-1' },
                            uuid: 'user-1',
                            email: 'dev@kodus.io',
                        },
                    },
                },
            ],
        }).compile();

        useCase = module.get(CreateOrUpdateCodyRulesUseCase);
    });

    it('persists create flow as pending_add when centralized PR mode is active', async () => {
        centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled.mockResolvedValue(
            {
                mode: 'centralized-pr',
                prUrl: 'https://example.com/pr/10',
            } as CentralizedPrMetadata,
        );
        centralizedConfigPrServiceMock.resolveRepositoryFolderName.mockResolvedValue(
            'repo-one',
        );
        centralizedConfigPrServiceMock.sanitizeFileName.mockReturnValue(
            'avoid-debug',
        );
        centralizedConfigPrServiceMock.buildCentralizedPath.mockImplementation(
            ({ repositoryFolder, relativePath }) =>
                `${repositoryFolder}/${relativePath}`,
        );

        codyRulesServiceMock.findById.mockResolvedValue(null);
        const result = await useCase.execute(
            {
                type: CodyRulesType.STANDARD,
                title: 'Avoid debug logs',
                rule: 'Do not commit debug logs',
                severity: 'medium' as any,
                scope: CodyRulesScope.FILE,
                path: '**/*',
                origin: CodyRulesOrigin.MANUAL,
                repositoryId: 'repo-1',
                examples: [],
            },
            'org-1',
        );

        expect(result).toEqual(
            expect.objectContaining({ mode: 'centralized-pr' }),
        );
        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                title: 'Avoid debug logs',
                repositoryId: 'repo-1',
                status: CodyRulesStatus.ACTIVE,
                centralizedConfig: {
                    path: 'repo-one/.cody-rules/review/avoid-debug.yml',
                    status: CodyRuleCentralizedStatus.PENDING_ADD,
                },
            }),
            expect.anything(),
        );
    });

    it('keeps existing centralized source path when updating a centralized-pending rule', async () => {
        centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled.mockResolvedValue(
            {
                mode: 'centralized-pr',
                prUrl: 'https://example.com/pr/10',
            } as CentralizedPrMetadata,
        );
        centralizedConfigPrServiceMock.resolveRepositoryFolderName.mockResolvedValue(
            'repo-one',
        );

        codyRulesServiceMock.findById.mockResolvedValue({
            uuid: 'rule-1',
            type: CodyRulesType.STANDARD,
            title: 'Avoid debug logs',
            rule: 'Do not commit debug logs',
            severity: 'medium',
            scope: CodyRulesScope.FILE,
            path: '**/*',
            origin: CodyRulesOrigin.MANUAL,
            repositoryId: 'repo-1',
            status: CodyRulesStatus.ACTIVE,
            centralizedConfig: {
                path: 'repo-one/.cody-rules/review/existing.yml',
                status: CodyRuleCentralizedStatus.PENDING_EDIT,
            },
        } as any);
        codyRulesServiceMock.createOrUpdate.mockResolvedValue({
            uuid: 'rule-1',
        } as any);

        await useCase.execute(
            {
                uuid: 'rule-1',
                type: CodyRulesType.STANDARD,
                title: 'Avoid debug logs v2',
                rule: 'Do not commit verbose debug logs',
                severity: 'medium' as any,
                scope: CodyRulesScope.FILE,
                path: '**/*',
                origin: CodyRulesOrigin.MANUAL,
                repositoryId: 'repo-1',
                examples: [],
            },
            'org-1',
        );

        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                uuid: 'rule-1',
                status: CodyRulesStatus.ACTIVE,
                centralizedConfig: {
                    path: 'repo-one/.cody-rules/review/existing.yml',
                    status: CodyRuleCentralizedStatus.PENDING_EDIT,
                },
            }),
            expect.anything(),
        );
    });

    it('uses explicit teamId for global rule centralized mutation and writes pending_add snapshot', async () => {
        centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled.mockResolvedValue(
            {
                mode: 'centralized-pr',
                prUrl: 'https://example.com/pr/11',
            } as CentralizedPrMetadata,
        );
        centralizedConfigPrServiceMock.resolveRepositoryFolderName.mockResolvedValue(
            'global',
        );
        centralizedConfigPrServiceMock.sanitizeFileName.mockReturnValue(
            'no-hardcoded-secrets',
        );
        centralizedConfigPrServiceMock.buildCentralizedPath.mockImplementation(
            ({ repositoryFolder, relativePath }) =>
                `${repositoryFolder}/${relativePath}`,
        );

        (useCase as any).request = {
            user: {
                organization: { uuid: 'org-1' },
                uuid: 'user-1',
                email: 'dev@kodus.io',
            },
        };

        codyRulesServiceMock.findById.mockResolvedValue(null);

        await useCase.execute(
            {
                type: CodyRulesType.STANDARD,
                title: 'No hardcoded secrets',
                rule: 'Avoid hardcoded credentials in source code',
                severity: 'high' as any,
                scope: CodyRulesScope.FILE,
                path: '**/*',
                origin: CodyRulesOrigin.MANUAL,
                repositoryId: 'global',
                examples: [],
            },
            'org-1',
            undefined,
            undefined,
            'team-explicit',
        );

        expect(
            centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                organizationAndTeamData: {
                    organizationId: 'org-1',
                    teamId: 'team-explicit',
                },
                repositoryId: 'global',
            }),
        );

        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                organizationId: 'org-1',
                teamId: 'team-explicit',
            }),
            expect.objectContaining({
                repositoryId: 'global',
                status: CodyRulesStatus.ACTIVE,
                centralizedConfig: {
                    path: 'global/.cody-rules/review/no-hardcoded-secrets.yml',
                    status: CodyRuleCentralizedStatus.PENDING_ADD,
                },
            }),
            expect.anything(),
        );
    });

    it('updates existing file path when legacy rule has no centralizedConfig path', async () => {
        centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled.mockResolvedValue(
            {
                mode: 'centralized-pr',
                prUrl: 'https://example.com/pr/12',
            } as CentralizedPrMetadata,
        );
        centralizedConfigPrServiceMock.resolveRepositoryFolderName.mockResolvedValue(
            'repo-one',
        );
        centralizedConfigPrServiceMock.sanitizeFileName
            .mockReturnValueOnce('legacy-title')
            .mockReturnValueOnce('legacy-title');
        centralizedConfigPrServiceMock.buildCentralizedPath.mockImplementation(
            ({ repositoryFolder, relativePath }) =>
                `${repositoryFolder}/${relativePath}`,
        );

        codyRulesServiceMock.findById.mockResolvedValue({
            uuid: 'rule-legacy-1',
            type: CodyRulesType.STANDARD,
            title: 'Legacy Title',
            rule: 'Original rule content',
            severity: 'medium',
            scope: CodyRulesScope.FILE,
            path: '**/*',
            origin: CodyRulesOrigin.MANUAL,
            repositoryId: 'repo-1',
            status: CodyRulesStatus.ACTIVE,
            centralizedConfig: undefined,
        } as any);
        codyRulesServiceMock.createOrUpdate.mockResolvedValue({
            uuid: 'rule-legacy-1',
        } as any);

        await useCase.execute(
            {
                uuid: 'rule-legacy-1',
                type: CodyRulesType.STANDARD,
                title: 'New Title',
                rule: 'Updated rule content',
                severity: 'medium' as any,
                scope: CodyRulesScope.FILE,
                path: '**/*',
                origin: CodyRulesOrigin.MANUAL,
                repositoryId: 'repo-1',
                examples: [],
            },
            'org-1',
        );

        expect(
            centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                repositoryId: 'repo-1',
                files: expect.any(Function),
            }),
        );

        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                uuid: 'rule-legacy-1',
                status: CodyRulesStatus.ACTIVE,
                centralizedConfig: {
                    path: 'repo-one/.cody-rules/review/legacy-title-rule-leg.yml',
                    status: CodyRuleCentralizedStatus.PENDING_EDIT,
                },
            }),
            expect.anything(),
        );
    });

    it('bypasses centralized PR routing for internal sync actor', async () => {
        codyRulesServiceMock.createOrUpdate.mockResolvedValue({
            uuid: 'synced-rule-1',
        } as any);

        const result = await useCase.execute(
            {
                type: CodyRulesType.STANDARD,
                title: 'Synced from centralized',
                rule: 'Always prefer safe defaults',
                severity: 'medium' as any,
                scope: CodyRulesScope.FILE,
                path: '**/*',
                origin: CodyRulesOrigin.MANUAL,
                repositoryId: 'repo-1',
                examples: [],
            },
            'org-1',
            {
                userId: 'cody',
                userEmail: 'cody@kodus.io',
            },
            true,
        );

        expect(
            centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled,
        ).not.toHaveBeenCalled();
        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalled();
        expect(result).toEqual(
            expect.objectContaining({ uuid: 'synced-rule-1' }),
        );
    });

    it('throws and avoids direct DB write when centralized is enabled but PR routing returns direct', async () => {
        centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled.mockResolvedValue(
            {
                mode: 'direct',
            },
        );
        centralizedConfigPrServiceMock.getCentralizedRepositoryIfEnabled.mockResolvedValue(
            {
                id: 'central-repo-id',
                name: 'central-repo',
            },
        );

        codyRulesServiceMock.findById.mockResolvedValue(null);

        await expect(
            useCase.execute(
                {
                    type: CodyRulesType.STANDARD,
                    title: 'Avoid debug logs',
                    rule: 'Do not commit debug logs',
                    severity: 'medium' as any,
                    scope: CodyRulesScope.FILE,
                    path: '**/*',
                    origin: CodyRulesOrigin.MANUAL,
                    repositoryId: 'repo-1',
                    examples: [],
                },
                'org-1',
            ),
        ).rejects.toThrow(
            'Centralized config is enabled, but rule mutation was not routed through centralized PR flow',
        );

        expect(codyRulesServiceMock.createOrUpdate).not.toHaveBeenCalled();
    });

    it('does NOT route a PENDING rule through centralized config — persists directly, no throw', async () => {
        // Centralized config is the source of truth for approved rules only.
        // A rule awaiting approval (e.g. a gated IDE-synced rule) must be
        // written to the DB as pending, not exported to the rolling PR.
        centralizedConfigPrServiceMock.getCentralizedRepositoryIfEnabled.mockResolvedValue(
            { id: 'central-repo-id', name: 'central-repo' },
        );
        codyRulesServiceMock.findById.mockResolvedValue(null);
        codyRulesServiceMock.createOrUpdate.mockResolvedValue({
            uuid: 'pending-rule-1',
        } as any);

        const result = await useCase.execute(
            {
                type: CodyRulesType.STANDARD,
                title: 'Auto-synced rule',
                rule: 'From a repo file',
                severity: 'medium' as any,
                scope: CodyRulesScope.FILE,
                path: '**/*',
                origin: CodyRulesOrigin.REPO_FILE_SYNC,
                repositoryId: 'repo-1',
                examples: [],
                status: CodyRulesStatus.PENDING,
            },
            'org-1',
        );

        expect(
            centralizedConfigPrServiceMock.createMutationPullRequestIfEnabled,
        ).not.toHaveBeenCalled();
        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalled();
        expect(result).toEqual(
            expect.objectContaining({ uuid: 'pending-rule-1' }),
        );
    });
});
