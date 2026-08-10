import { Test, TestingModule } from '@nestjs/testing';

import { CentralizedConfigPrService } from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';
import { CodyRuleSeverity } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import { DeleteRuleInOrganizationByIdCodyRulesUseCase } from '@libs/codyRules/application/use-cases/delete-rule-in-organization-by-id.use-case';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import {
    CodyRulesScope,
    CodyRulesStatus,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

import { CodyRulesTools } from './codyRules.tools';

describe('CodyRulesTools.createCodyRule', () => {
    const baseUrl = 'https://app.kodus.io';
    let tools: CodyRulesTools;
    let mockCodyRulesService: jest.Mocked<ICodyRulesService>;
    let mockCentralizedConfigPrService: jest.Mocked<CentralizedConfigPrService>;
    let mockDeleteRuleUseCase: jest.Mocked<DeleteRuleInOrganizationByIdCodyRulesUseCase>;
    let previousBaseUrl: string | undefined;

    beforeEach(async () => {
        previousBaseUrl = process.env.API_USER_INVITE_BASE_URL;
        process.env.API_USER_INVITE_BASE_URL = baseUrl;

        mockCodyRulesService = {
            createOrUpdate: jest.fn(),
        } as unknown as jest.Mocked<ICodyRulesService>;

        mockCentralizedConfigPrService = {
            createMutationPullRequestIfEnabled: jest
                .fn()
                .mockResolvedValue({ mode: 'direct' }),
            resolveDirectoryGroupFolderName: jest.fn().mockResolvedValue(null),
        } as unknown as jest.Mocked<CentralizedConfigPrService>;

        mockDeleteRuleUseCase =
            {} as unknown as jest.Mocked<DeleteRuleInOrganizationByIdCodyRulesUseCase>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CodyRulesTools,
                {
                    provide: CODY_RULES_SERVICE_TOKEN,
                    useValue: mockCodyRulesService,
                },
                {
                    provide: CentralizedConfigPrService,
                    useValue: mockCentralizedConfigPrService,
                },
                {
                    provide: DeleteRuleInOrganizationByIdCodyRulesUseCase,
                    useValue: mockDeleteRuleUseCase,
                },
            ],
        }).compile();

        tools = module.get<CodyRulesTools>(CodyRulesTools);
    });

    afterEach(() => {
        process.env.API_USER_INVITE_BASE_URL = previousBaseUrl;
    });

    const runCreate = (overrides?: { repositoryId?: string }) =>
        tools.createCodyRule().execute(
            {
                organizationId: 'org-1',
                codyRule: {
                    title: 'Avoid console.log',
                    rule: 'Do not commit console.log statements',
                    severity: CodyRuleSeverity.MEDIUM,
                    scope: CodyRulesScope.PULL_REQUEST,
                    repositoryId: overrides?.repositoryId,
                    teamId: 'team-1',
                },
            } as any,
            undefined,
        );

    it('returns a link to the pending standard-rules list when the rule is PENDING', async () => {
        mockCodyRulesService.createOrUpdate.mockResolvedValue({
            uuid: 'rule-123',
            title: 'Avoid console.log',
            rule: 'Do not commit console.log statements',
            status: CodyRulesStatus.PENDING,
            repositoryId: 'repo-1',
        } as any);

        const result = await runCreate({ repositoryId: 'repo-1' });

        const structured = (result as any).structuredContent;
        expect(structured.success).toBe(true);
        expect(structured.data).toEqual(
            expect.objectContaining({
                uuid: 'rule-123',
                status: CodyRulesStatus.PENDING,
            }),
        );
        expect(structured.link).toBe(
            'https://app.kodus.io/settings/code-review/repo-1/cody-rules?tab=review-rules',
        );
        expect(structured.message).toMatch(/awaiting approval/i);
    });

    it('uses the global scope when no repositoryId is provided', async () => {
        mockCodyRulesService.createOrUpdate.mockResolvedValue({
            uuid: 'rule-456',
            title: 'Avoid console.log',
            rule: 'Do not commit console.log statements',
            status: CodyRulesStatus.PENDING,
            repositoryId: 'global',
        } as any);

        const result = await runCreate();
        const structured = (result as any).structuredContent;

        expect(structured.link).toBe(
            'https://app.kodus.io/settings/code-review/global/cody-rules?tab=review-rules',
        );
    });

    it('returns the edit URL when the rule lands as ACTIVE (no approval needed)', async () => {
        mockCodyRulesService.createOrUpdate.mockResolvedValue({
            uuid: 'rule-789',
            title: 'Avoid console.log',
            rule: 'Do not commit console.log statements',
            status: CodyRulesStatus.ACTIVE,
            repositoryId: 'repo-1',
        } as any);

        const result = await runCreate({ repositoryId: 'repo-1' });
        const structured = (result as any).structuredContent;

        expect(structured.link).toBe(
            'https://app.kodus.io/settings/code-review/repo-1/cody-rules/rule-789?tab=review-rules&teamId=team-1',
        );
        expect(structured.message).not.toMatch(/awaiting/i);
    });

    it('returns the PR URL as both prUrl and link in centralized-PR mode', async () => {
        mockCentralizedConfigPrService.createMutationPullRequestIfEnabled.mockResolvedValueOnce(
            {
                mode: 'centralized-pr',
                prUrl: 'https://github.com/org/repo/pull/42',
                message: 'Centralized config is enabled.',
            } as any,
        );

        const result = await runCreate({ repositoryId: 'repo-1' });
        const structured = (result as any).structuredContent;

        expect(structured.prUrl).toBe(
            'https://github.com/org/repo/pull/42',
        );
        expect(structured.link).toBe(
            'https://github.com/org/repo/pull/42',
        );
        expect(mockCodyRulesService.createOrUpdate).not.toHaveBeenCalled();
    });
});

describe('CodyRulesTools.updateCodyRule', () => {
    const baseUrl = 'https://app.kodus.io';
    let tools: CodyRulesTools;
    let mockCodyRulesService: jest.Mocked<ICodyRulesService>;
    let mockCentralizedConfigPrService: jest.Mocked<CentralizedConfigPrService>;
    let mockDeleteRuleUseCase: jest.Mocked<DeleteRuleInOrganizationByIdCodyRulesUseCase>;
    let previousBaseUrl: string | undefined;

    beforeEach(async () => {
        previousBaseUrl = process.env.API_USER_INVITE_BASE_URL;
        process.env.API_USER_INVITE_BASE_URL = baseUrl;

        mockCodyRulesService = {
            findById: jest.fn(),
            updateRuleWithLogging: jest.fn(),
        } as unknown as jest.Mocked<ICodyRulesService>;

        mockCentralizedConfigPrService = {
            createMutationPullRequestIfEnabled: jest
                .fn()
                .mockResolvedValue({ mode: 'direct' }),
            resolveDirectoryGroupFolderName: jest.fn().mockResolvedValue(null),
        } as unknown as jest.Mocked<CentralizedConfigPrService>;

        mockDeleteRuleUseCase =
            {} as unknown as jest.Mocked<DeleteRuleInOrganizationByIdCodyRulesUseCase>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CodyRulesTools,
                {
                    provide: CODY_RULES_SERVICE_TOKEN,
                    useValue: mockCodyRulesService,
                },
                {
                    provide: CentralizedConfigPrService,
                    useValue: mockCentralizedConfigPrService,
                },
                {
                    provide: DeleteRuleInOrganizationByIdCodyRulesUseCase,
                    useValue: mockDeleteRuleUseCase,
                },
            ],
        }).compile();

        tools = module.get<CodyRulesTools>(CodyRulesTools);
    });

    afterEach(() => {
        process.env.API_USER_INVITE_BASE_URL = previousBaseUrl;
    });

    const runUpdate = (overrides?: { teamId?: string }) =>
        tools.updateCodyRule().execute(
            {
                organizationId: 'org-1',
                ruleId: 'rule-789',
                codyRule: {
                    title: 'Updated title',
                    teamId: overrides?.teamId ?? 'team-1',
                },
            } as any,
            undefined,
        );

    it('returns a link to the edit page and a message after a direct update', async () => {
        (mockCodyRulesService.findById as jest.Mock).mockResolvedValue({
            uuid: 'rule-789',
            title: 'Old title',
            rule: 'Some rule body',
            status: CodyRulesStatus.ACTIVE,
            repositoryId: 'repo-1',
        } as any);
        (mockCodyRulesService.updateRuleWithLogging as jest.Mock).mockResolvedValue({
            uuid: 'rule-789',
            title: 'Updated title',
            rule: 'Some rule body',
            status: CodyRulesStatus.ACTIVE,
            repositoryId: 'repo-1',
        } as any);

        const result = await runUpdate();
        const structured = (result as any).structuredContent;

        expect(structured.success).toBe(true);
        expect(structured.link).toBe(
            'https://app.kodus.io/settings/code-review/repo-1/cody-rules/rule-789?tab=review-rules&teamId=team-1',
        );
        expect(structured.message).toMatch(/updated/i);
    });

    it('returns the PR URL as both prUrl and link in centralized-PR mode on update', async () => {
        (mockCodyRulesService.findById as jest.Mock).mockResolvedValue({
            uuid: 'rule-789',
            title: 'Old title',
            rule: 'Some rule body',
            status: CodyRulesStatus.ACTIVE,
            repositoryId: 'repo-1',
        } as any);
        mockCentralizedConfigPrService.createMutationPullRequestIfEnabled.mockResolvedValueOnce(
            {
                mode: 'centralized-pr',
                prUrl: 'https://github.com/org/repo/pull/99',
                message: 'Centralized config is enabled.',
            } as any,
        );

        const result = await runUpdate();
        const structured = (result as any).structuredContent;

        expect(structured.prUrl).toBe('https://github.com/org/repo/pull/99');
        expect(structured.link).toBe('https://github.com/org/repo/pull/99');
        expect(
            mockCodyRulesService.updateRuleWithLogging,
        ).not.toHaveBeenCalled();
    });

    it('returns success=false when the rule does not exist', async () => {
        (mockCodyRulesService.findById as jest.Mock).mockResolvedValue(null);

        const result = await runUpdate();
        const structured = (result as any).structuredContent;

        expect(structured.success).toBe(false);
        expect(structured.message).toMatch(/not found/i);
    });
});
