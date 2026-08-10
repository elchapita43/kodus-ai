import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import { ApplyPendingCodyRulesUseCase } from '@libs/codyRules/application/use-cases/apply-pending-cody-rules.use-case';
import { CreateOrUpdateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/create-or-update.use-case';
import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-rules-in-organization-by-filter.use-case';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    CodyRuleRequestType,
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

describe('ApplyPendingCodyRulesUseCase', () => {
    let useCase: ApplyPendingCodyRulesUseCase;
    let codyRulesServiceMock: jest.Mocked<ICodyRulesService>;
    let createOrUpdateUseCaseMock: { execute: jest.Mock };
    let findRulesUseCaseMock: { execute: jest.Mock };
    let authorizationServiceMock: { ensure: jest.Mock };
    let requestMock: any;

    beforeEach(async () => {
        codyRulesServiceMock = {
            createOrUpdate: jest.fn(),
        } as unknown as jest.Mocked<ICodyRulesService>;

        createOrUpdateUseCaseMock = {
            execute: jest.fn(),
        };

        findRulesUseCaseMock = {
            execute: jest.fn(),
        };

        authorizationServiceMock = {
            ensure: jest.fn().mockResolvedValue(undefined),
        };

        requestMock = {
            user: {
                uuid: 'user-1',
                email: 'dev@kodus.io',
                organization: { uuid: 'org-1' },
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApplyPendingCodyRulesUseCase,
                {
                    provide: CODY_RULES_SERVICE_TOKEN,
                    useValue: codyRulesServiceMock,
                },
                {
                    provide: CreateOrUpdateCodyRulesUseCase,
                    useValue: createOrUpdateUseCaseMock,
                },
                {
                    provide:
                        FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
                    useValue: findRulesUseCaseMock,
                },
                {
                    provide: AuthorizationService,
                    useValue: authorizationServiceMock,
                },
                {
                    provide: REQUEST,
                    useValue: requestMock,
                },
            ],
        }).compile();

        useCase = module.get(ApplyPendingCodyRulesUseCase);
    });

    it('throws when organization id is missing', async () => {
        requestMock.user.organization.uuid = undefined;

        await expect(useCase.execute({ ruleIds: ['r1'] })).rejects.toThrow(
            'Organization ID not found',
        );
    });

    it('throws when any requested rule does not exist', async () => {
        findRulesUseCaseMock.execute.mockResolvedValue([]);

        await expect(useCase.execute({ ruleIds: ['missing'] })).rejects.toThrow(
            'Rule not found: missing',
        );
    });

    it('authorizes with deduplicated repo ids from pending and target rules', async () => {
        findRulesUseCaseMock.execute.mockResolvedValue([
            {
                uuid: 'target-1',
                title: 'target',
                rule: 'target rule',
                repositoryId: 'repo-1',
                status: CodyRulesStatus.ACTIVE,
                type: CodyRulesType.MEMORY,
            },
            {
                uuid: 'pending-1',
                title: 'pending',
                rule: 'pending rule',
                repositoryId: 'repo-1',
                status: CodyRulesStatus.PENDING,
                type: CodyRulesType.MEMORY,
                requestType: CodyRuleRequestType.UPDATE,
                targetRuleUuid: 'target-1',
            },
        ]);

        createOrUpdateUseCaseMock.execute.mockResolvedValue({
            uuid: 'ok',
        } as any);
        codyRulesServiceMock.createOrUpdate.mockResolvedValue({
            uuid: 'pending-1',
            status: CodyRulesStatus.APPLIED,
        } as any);

        await useCase.execute({ ruleIds: ['pending-1'] });

        expect(authorizationServiceMock.ensure).toHaveBeenCalledWith(
            expect.objectContaining({
                repoIds: ['repo-1'],
            }),
        );
    });

    it('applies memory update by updating target with centralized-aware routing and marking pending as applied', async () => {
        findRulesUseCaseMock.execute.mockResolvedValue([
            {
                uuid: 'target-1',
                title: 'Target old',
                rule: 'Old rule',
                repositoryId: 'repo-1',
                status: CodyRulesStatus.ACTIVE,
                type: CodyRulesType.MEMORY,
            },
            {
                uuid: 'pending-1',
                title: 'Target new',
                rule: 'New rule',
                repositoryId: 'repo-1',
                status: CodyRulesStatus.PENDING,
                type: CodyRulesType.MEMORY,
                requestType: CodyRuleRequestType.UPDATE,
                targetRuleUuid: 'target-1',
            },
        ]);

        createOrUpdateUseCaseMock.execute.mockResolvedValueOnce({
            uuid: 'target-1',
            title: 'Target new',
        } as any);
        codyRulesServiceMock.createOrUpdate.mockResolvedValueOnce({
            uuid: 'pending-1',
            status: CodyRulesStatus.APPLIED,
        } as any);

        const result = await useCase.execute({ ruleIds: ['pending-1'] });

        expect(createOrUpdateUseCaseMock.execute).toHaveBeenCalledTimes(1);
        expect(createOrUpdateUseCaseMock.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                uuid: 'target-1',
                title: 'Target new',
                rule: 'New rule',
                status: CodyRulesStatus.ACTIVE,
            }),
            'org-1',
            { userId: 'user-1', userEmail: 'dev@kodus.io' },
            true,
            undefined,
        );

        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalledTimes(1);
        expect(codyRulesServiceMock.createOrUpdate).toHaveBeenCalledWith(
            { organizationId: 'org-1', teamId: undefined },
            expect.objectContaining({
                uuid: 'pending-1',
                status: CodyRulesStatus.APPLIED,
                targetRuleUuid: 'target-1',
            }),
            { userId: 'user-1', userEmail: 'dev@kodus.io' },
        );
        expect(result).toEqual([{ uuid: 'target-1', title: 'Target new' }]);
    });

    it('returns centralized PR metadata when activation routes through centralized config flow', async () => {
        findRulesUseCaseMock.execute.mockResolvedValue([
            {
                uuid: 'pending-standard-1',
                title: 'Standard pending',
                rule: 'Standard rule',
                repositoryId: 'repo-2',
                status: CodyRulesStatus.PENDING,
                type: CodyRulesType.STANDARD,
            },
        ]);

        createOrUpdateUseCaseMock.execute.mockResolvedValue({
            mode: 'centralized-pr',
            prUrl: 'https://example.com/pr/22',
            message: 'Queued in centralized PR',
        });

        const result = await useCase.execute({
            ruleIds: ['pending-standard-1'],
        });

        expect(createOrUpdateUseCaseMock.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                uuid: 'pending-standard-1',
                status: CodyRulesStatus.ACTIVE,
            }),
            'org-1',
            { userId: 'user-1', userEmail: 'dev@kodus.io' },
            true,
            undefined,
        );
        expect(codyRulesServiceMock.createOrUpdate).not.toHaveBeenCalled();
        expect(result).toEqual({
            mode: 'centralized-pr',
            prUrl: 'https://example.com/pr/22',
            message: 'Queued in centralized PR',
        });
    });

    it('activates pending non-memory-update rules through centralized-aware create-or-update use case', async () => {
        findRulesUseCaseMock.execute.mockResolvedValue([
            {
                uuid: 'pending-standard-1',
                title: 'Standard pending',
                rule: 'Standard rule',
                repositoryId: 'repo-2',
                status: CodyRulesStatus.PENDING,
                type: CodyRulesType.STANDARD,
            },
        ]);

        createOrUpdateUseCaseMock.execute.mockResolvedValue({
            uuid: 'pending-standard-1',
            status: CodyRulesStatus.ACTIVE,
        } as any);

        const result = await useCase.execute({
            ruleIds: ['pending-standard-1'],
        });

        expect(createOrUpdateUseCaseMock.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                uuid: 'pending-standard-1',
                status: CodyRulesStatus.ACTIVE,
            }),
            'org-1',
            { userId: 'user-1', userEmail: 'dev@kodus.io' },
            true,
            undefined,
        );
        expect(codyRulesServiceMock.createOrUpdate).not.toHaveBeenCalled();
        expect(result).toEqual([
            { uuid: 'pending-standard-1', status: CodyRulesStatus.ACTIVE },
        ]);
    });
});
