import { ListLearningStatsUseCase } from './list-learning-stats.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('ListLearningStatsUseCase', () => {
    const mk = (over: Partial<any> = {}) => ({
        id: over.id ?? 'l1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'x',
        kind: over.kind ?? LearningKind.CONVENTION,
        confidence: 'medium',
        sourceType: over.sourceType ?? LearningSourceType.PR,
        sourceRef: null,
        sourceUrl: null,
        status: over.status ?? LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const repo = { count: jest.fn(), find: jest.fn() };
    const useCase = new ListLearningStatsUseCase(repo as any);

    beforeEach(() => jest.clearAllMocks());

    it('aggregates totals and breakdowns', async () => {
        repo.count.mockResolvedValueOnce(3); // total
        repo.count.mockResolvedValueOnce(2); // active
        repo.count.mockResolvedValueOnce(1); // superseded
        repo.find.mockResolvedValue([
            mk({ kind: LearningKind.CONVENTION, sourceType: LearningSourceType.PR }),
            mk({ id: 'l2', kind: LearningKind.CONVENTION, sourceType: LearningSourceType.PR }),
            mk({ id: 'l3', kind: LearningKind.DECISION, sourceType: LearningSourceType.MANUAL, status: LearningStatus.SUPERSEDED }),
        ]);

        const stats = await useCase.execute({ organizationId: 'org-1', repositoryId: 'repo-1' });

        expect(stats.total).toBe(3);
        expect(stats.active).toBe(2);
        expect(stats.superseded).toBe(1);
        expect(stats.byKind).toEqual({ convention: 2, decision: 1 });
        expect(stats.bySource).toEqual({ pr: 2, manual: 1 });
    });
});
