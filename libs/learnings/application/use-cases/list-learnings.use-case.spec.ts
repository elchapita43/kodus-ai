import { ListLearningsUseCase } from './list-learnings.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('ListLearningsUseCase', () => {
    const learning = {
        id: 'l1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'Usar convenciones del repo',
        kind: LearningKind.CONVENTION,
        confidence: 'high',
        sourceType: LearningSourceType.PR,
        sourceRef: '#1140',
        sourceUrl: null,
        status: LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const repo = {
        find: jest.fn(),
        count: jest.fn(),
    };

    const useCase = new ListLearningsUseCase(repo as any);

    beforeEach(() => jest.clearAllMocks());

    it('lists learnings with pagination and total', async () => {
        repo.find.mockResolvedValue([learning]);
        repo.count.mockResolvedValue(1);

        const result = await useCase.execute({
            organizationId: 'org-1',
            repositoryId: 'repo-1',
            page: 1,
            limit: 10,
        });

        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(repo.find).toHaveBeenCalledWith(
            expect.objectContaining({
                organizationId: 'org-1',
                repositoryId: 'repo-1',
                page: 1,
                limit: 10,
            }),
        );
    });

    it('requires organizationId', async () => {
        await expect(useCase.execute({ organizationId: '' })).rejects.toThrow(
            'organizationId es requerido',
        );
    });

    it('defaults pagination to page 1 limit 20', async () => {
        repo.find.mockResolvedValue([]);
        repo.count.mockResolvedValue(0);

        await useCase.execute({ organizationId: 'org-1' });

        expect(repo.find).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 20 }),
        );
    });

    it('passes filters to the repository', async () => {
        repo.find.mockResolvedValue([]);
        repo.count.mockResolvedValue(0);

        await useCase.execute({
            organizationId: 'org-1',
            status: LearningStatus.ACTIVE,
            kind: LearningKind.CONVENTION,
            q: 'env',
        });

        expect(repo.find).toHaveBeenCalledWith(
            expect.objectContaining({
                status: LearningStatus.ACTIVE,
                kind: LearningKind.CONVENTION,
                q: 'env',
            }),
        );
    });
});
