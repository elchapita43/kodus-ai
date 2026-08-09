import { GetLearningUseCase } from './get-learning.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('GetLearningUseCase', () => {
    const learning = {
        id: 'l1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'No romper tests existentes',
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

    const repo = { findById: jest.fn() };
    const useCase = new GetLearningUseCase(repo as any);

    beforeEach(() => jest.clearAllMocks());

    it('returns the learning when it belongs to the org', async () => {
        repo.findById.mockResolvedValue(learning);
        const result = await useCase.execute('l1', 'org-1');
        expect(result.id).toBe('l1');
    });

    it('throws when not found', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(useCase.execute('nope', 'org-1')).rejects.toThrow(
            'Learning no encontrado',
        );
    });

    it('throws when learning belongs to another org (scoping)', async () => {
        repo.findById.mockResolvedValue(learning);
        await expect(useCase.execute('l1', 'org-OTHER')).rejects.toThrow(
            'Learning no encontrado',
        );
    });
});
