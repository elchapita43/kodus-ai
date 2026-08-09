import { CreateLearningUseCase } from './create-learning.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('CreateLearningUseCase', () => {
    const repo = { create: jest.fn() };
    const useCase = new CreateLearningUseCase(repo as any);

    beforeEach(() => jest.clearAllMocks());

    it('creates a manual learning with defaults', async () => {
        repo.create.mockImplementation(async (l: any) => l);

        const result = await useCase.execute({
            organizationId: 'org-1',
            repositoryId: 'repo-1',
            content: '  No commitear secrets  ',
        });

        expect(result.content).toBe('No commitear secrets');
        expect(result.kind).toBe(LearningKind.CONVENTION);
        expect(result.sourceType).toBe(LearningSourceType.MANUAL);
        expect(result.createdBy).toBe('human');
        expect(result.status).toBe(LearningStatus.ACTIVE);
        expect(result.id).toBeDefined();
    });

    it('rejects empty content', async () => {
        await expect(
            useCase.execute({
                organizationId: 'org-1',
                repositoryId: 'repo-1',
                content: '   ',
            }),
        ).rejects.toThrow('no puede estar vacío');
    });

    it('rejects missing org/repo', async () => {
        await expect(
            useCase.execute({
                organizationId: '',
                repositoryId: 'repo-1',
                content: 'x',
            }),
        ).rejects.toThrow('organizationId y repositoryId');
    });
});
