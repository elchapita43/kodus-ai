import { GetInheritedRulesCodyRulesUseCase } from '@libs/codyRules/application/use-cases/get-inherited-cody-rules.use-case';
import { CodyRulesStatus } from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';

/**
 * Regression coverage for the `/inherited-rules` endpoint that feeds the
 * Cody Rules settings page.
 *
 *  - Only ACTIVE rules are inherited (paused/pending/deleted do not flow
 *    down to child scopes — the product rule is "rules count/inherit only
 *    when active").
 *  - `severity` is lower-cased to match the scope-local listing path
 *    (`CodyRulesService.find()`), so the same rule never reaches the page
 *    case-mismatched depending on which endpoint served it.
 */
describe('GetInheritedRulesCodyRulesUseCase', () => {
    const organizationAndTeamData: OrganizationAndTeamData = {
        organizationId: 'org-1',
        teamId: 'team-1',
    };

    const REPOSITORY_ID = 'repo-1';

    const buildUseCase = (rules: any[]) => {
        const codyRulesService = {
            findByOrganizationId: jest.fn().mockResolvedValue({ rules }),
        };

        // Pass the candidate rules straight through so the test exercises
        // the use-case's own status filter and severity normalization
        // rather than the folder-matching logic (covered elsewhere).
        const codyRulesValidationService = {
            getCodyRulesForFolder: jest
                .fn()
                .mockImplementation((_path: any, candidateRules: any[]) => candidateRules),
        };

        const parametersService = {
            findByKey: jest.fn().mockResolvedValue({
                configValue: {
                    repositories: [{ id: REPOSITORY_ID, directories: [] }],
                },
            }),
        };

        // No rule carries a contextReferenceId, so enrichment collects an
        // empty id set and never calls the batch loader.
        const contextReferenceService = {
            findById: jest.fn(),
            findByIds: jest.fn().mockResolvedValue([]),
        };

        const useCase = new GetInheritedRulesCodyRulesUseCase(
            codyRulesValidationService as any,
            parametersService as any,
            codyRulesService as any,
            contextReferenceService as any,
        );

        return { useCase, codyRulesService };
    };

    it('inherits only ACTIVE global rules', async () => {
        const { useCase } = buildUseCase([
            {
                uuid: 'active-global',
                repositoryId: 'global',
                status: CodyRulesStatus.ACTIVE,
                severity: 'high',
                inheritance: {},
            },
            {
                uuid: 'paused-global',
                repositoryId: 'global',
                status: CodyRulesStatus.PAUSED,
                severity: 'high',
                inheritance: {},
            },
            {
                uuid: 'deleted-global',
                repositoryId: 'global',
                status: CodyRulesStatus.DELETED,
                severity: 'high',
                inheritance: {},
            },
        ]);

        const result = await useCase.execute(
            organizationAndTeamData,
            REPOSITORY_ID,
        );

        const globalUuids = result.globalRules.map((r) => r.uuid);
        expect(globalUuids).toEqual(['active-global']);
    });

    it('lower-cases severity so it matches the scope-local listing path', async () => {
        const { useCase } = buildUseCase([
            {
                uuid: 'mixed-case',
                repositoryId: 'global',
                status: CodyRulesStatus.ACTIVE,
                severity: 'Critical',
                inheritance: {},
            },
        ]);

        const result = await useCase.execute(
            organizationAndTeamData,
            REPOSITORY_ID,
        );

        expect(result.globalRules[0].severity).toBe('critical');
    });

    it('returns empty buckets for the global scope (nothing to inherit)', async () => {
        const { useCase, codyRulesService } = buildUseCase([]);

        const result = await useCase.execute(organizationAndTeamData, 'global');

        expect(result).toEqual({
            globalRules: [],
            repoRules: [],
            directoryRules: [],
        });
        // Short-circuits before touching the data layer.
        expect(codyRulesService.findByOrganizationId).not.toHaveBeenCalled();
    });
});
