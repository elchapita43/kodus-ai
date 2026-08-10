import { GetPendingCodyRulesUseCase } from '@libs/codyRules/application/use-cases/get-pending-cody-rules.use-case';
import {
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

describe('GetPendingCodyRulesUseCase', () => {
    const buildUseCase = (items: any[]) => {
        const findRulesUseCase = { execute: jest.fn().mockResolvedValue(items) };
        const request = { user: { organization: { uuid: 'org-1' } } } as any;
        return {
            useCase: new GetPendingCodyRulesUseCase(
                request,
                findRulesUseCase as any,
            ),
            findRulesUseCase,
        };
    };

    it('queries pending status, scoped to the repository, and splits counts by type', async () => {
        const { useCase, findRulesUseCase } = buildUseCase([
            { uuid: 'r1', type: CodyRulesType.STANDARD },
            { uuid: 'r2', type: CodyRulesType.STANDARD },
            { uuid: 'm1', type: CodyRulesType.MEMORY },
            { uuid: 'm2' }, // missing type → counts as a rule (STANDARD default)
        ]);

        const result = await useCase.execute({ repositoryId: 'repo-1' });

        expect(findRulesUseCase.execute).toHaveBeenCalledWith(
            'org-1',
            { status: CodyRulesStatus.PENDING },
            'repo-1',
        );
        expect(result.counts).toEqual({ total: 4, rules: 3, memories: 1 });
        expect(result.items).toHaveLength(4);
    });

    it('returns zeroed counts when nothing is pending', async () => {
        const { useCase } = buildUseCase([]);
        const result = await useCase.execute();
        expect(result).toEqual({
            items: [],
            counts: { total: 0, rules: 0, memories: 0 },
        });
    });

    it('throws when organization id is missing', async () => {
        const findRulesUseCase = { execute: jest.fn() };
        const useCase = new GetPendingCodyRulesUseCase(
            { user: { organization: {} } } as any,
            findRulesUseCase as any,
        );
        await expect(useCase.execute()).rejects.toThrow(
            'Organization ID not found',
        );
        expect(findRulesUseCase.execute).not.toHaveBeenCalled();
    });
});
