import { SupersedeLearningUseCase } from './supersede-learning.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('SupersedeLearningUseCase', () => {
    const existing = {
        id: 'l1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'Version vieja',
        kind: LearningKind.CONVENTION,
        confidence: 'medium',
        sourceType: LearningSourceType.PR,
        sourceRef: '#1140',
        sourceUrl: null,
        status: LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'system',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    };

    const repo = { findById: jest.fn(), save: jest.fn(), create: jest.fn() };
    const useCase = new SupersedeLearningUseCase(repo as any);

    beforeEach(() => jest.clearAllMocks());

    it('marks old as superseded and creates the replacement', async () => {
        repo.findById.mockResolvedValue(existing);
        repo.save.mockImplementation(async (l: any) => l);
        repo.create.mockImplementation(async (l: any) => l);

        const result = await useCase.execute('l1', 'org-1', 'Version nueva');

        // El viejo queda superseded
        const savedOld = repo.save.mock.calls[0][0];
        expect(savedOld.status).toBe(LearningStatus.SUPERSEDED);
        expect(savedOld.id).toBe('l1');

        // El nuevo apunta al viejo como supersedesId
        expect(result.content).toBe('Version nueva');
        expect(result.status).toBe(LearningStatus.ACTIVE);
        expect(result.supersedesId).toBe('l1');
        expect(result.createdBy).toBe('human');
    });

    it('throws when not found or wrong org', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(
            useCase.execute('nope', 'org-1', 'x'),
        ).rejects.toThrow('Learning no encontrado');

        repo.findById.mockResolvedValue(existing);
        await expect(
            useCase.execute('l1', 'org-OTHER', 'x'),
        ).rejects.toThrow('Learning no encontrado');
    });
});
