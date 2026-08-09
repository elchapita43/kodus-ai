import { DeleteLearningUseCase } from './delete-learning.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('DeleteLearningUseCase', () => {
    const existing = {
        id: 'l1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'x',
        kind: LearningKind.CONVENTION,
        confidence: 'medium',
        sourceType: LearningSourceType.MANUAL,
        sourceRef: null,
        sourceUrl: null,
        status: LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'human',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const repo = { findById: jest.fn(), save: jest.fn() };
    const useCase = new DeleteLearningUseCase(repo as any);

    beforeEach(() => jest.clearAllMocks());

    it('soft-deletes (marks superseded)', async () => {
        repo.findById.mockResolvedValue(existing);

        await useCase.execute('l1', 'org-1');

        const saved = repo.save.mock.calls[0][0];
        expect(saved.status).toBe(LearningStatus.SUPERSEDED);
    });

    it('throws when not found or wrong org', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(useCase.execute('nope', 'org-1')).rejects.toThrow(
            'Learning no encontrado',
        );

        repo.findById.mockResolvedValue(existing);
        await expect(useCase.execute('l1', 'org-OTHER')).rejects.toThrow(
            'Learning no encontrado',
        );
    });
});
