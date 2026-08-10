import { LearnFromHumanFeedbackUseCase } from './learn-from-human-feedback.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('LearnFromHumanFeedbackUseCase', () => {
    const suggestion = {
        suggestionId: 'sug-1',
        suggestionContent: 'Usar transacciones en las migraciones',
        repositoryId: 'repo-1',
        pullRequestNumber: 1140,
        organizationId: 'org-1',
    };

    const mkFeedback = (over: Partial<any> = {}) => ({
        organizationId: 'org-1',
        reactions: { thumbsUp: 1, thumbsDown: 0 },
        suggestionId: 'sug-1',
        pullRequest: {
            id: 'pr-1',
            number: 1140,
            repository: { id: 'repo-1', fullName: 'org/repo' },
        },
        ...over,
    });

    const learningRepo = { find: jest.fn(), create: jest.fn() };
    const suggestionRepo = { findOne: jest.fn() };
    const useCase = new LearnFromHumanFeedbackUseCase(
        learningRepo as any,
        suggestionRepo as any,
    );

    beforeEach(() => jest.clearAllMocks());

    it('creates a convention learning when the team thumbs up a suggestion', async () => {
        suggestionRepo.findOne.mockResolvedValue(suggestion);
        learningRepo.find.mockResolvedValue([]);
        learningRepo.create.mockImplementation(async (l: any) => l);

        const result = await useCase.execute(mkFeedback());

        expect(result).not.toBeNull();
        expect(result!.content).toBe(
            'El equipo aprobó: Usar transacciones en las migraciones',
        );
        expect(result!.kind).toBe(LearningKind.CONVENTION);
        expect(result!.confidence).toBe('high');
        expect(result!.sourceType).toBe(LearningSourceType.REVIEW);
        expect(result!.sourceRef).toBe('#1140');
        expect(result!.createdBy).toBe('human');
        expect(result!.status).toBe(LearningStatus.ACTIVE);
    });

    it('creates an attempted learning when the team thumbs down a suggestion', async () => {
        suggestionRepo.findOne.mockResolvedValue(suggestion);
        learningRepo.find.mockResolvedValue([]);
        learningRepo.create.mockImplementation(async (l: any) => l);

        const result = await useCase.execute(
            mkFeedback({ reactions: { thumbsUp: 0, thumbsDown: 2 } }),
        );

        expect(result!.kind).toBe(LearningKind.ATTEMPTED);
        expect(result!.content).toContain('El equipo rechazó');
        expect(result!.confidence).toBe('high');
    });

    it('skips when both reactions exist (ambivalent)', async () => {
        const result = await useCase.execute(
            mkFeedback({ reactions: { thumbsUp: 1, thumbsDown: 1 } }),
        );
        expect(result).toBeNull();
        expect(learningRepo.create).not.toHaveBeenCalled();
    });

    it('skips when there are no reactions', async () => {
        const result = await useCase.execute(
            mkFeedback({ reactions: { thumbsUp: 0, thumbsDown: 0 } }),
        );
        expect(result).toBeNull();
        expect(learningRepo.create).not.toHaveBeenCalled();
    });

    it('does not duplicate an existing learning for the same suggestion', async () => {
        suggestionRepo.findOne.mockResolvedValue(suggestion);
        learningRepo.find.mockResolvedValue([
            { id: 'existing-1', content: 'El equipo aprobó: Usar transacciones' },
        ]);

        const result = await useCase.execute(mkFeedback());

        expect(result).toBeNull();
        expect(learningRepo.create).not.toHaveBeenCalled();
    });

    it('falls back to a generic content when the suggestion is not found', async () => {
        suggestionRepo.findOne.mockResolvedValue(undefined);
        learningRepo.find.mockResolvedValue([]);
        learningRepo.create.mockImplementation(async (l: any) => l);

        const result = await useCase.execute(mkFeedback());

        expect(result!.content).toContain('Sugerencia aprobada');
    });

    it('never throws: falls back to generic content on suggestion repo errors', async () => {
        suggestionRepo.findOne.mockRejectedValue(new Error('db down'));
        learningRepo.find.mockResolvedValue([]);
        learningRepo.create.mockImplementation(async (l: any) => l);

        const result = await useCase.execute(mkFeedback());

        expect(result).not.toBeNull();
        expect(result!.content).toContain('Sugerencia aprobada');
    });

    it('never throws: swallows learnings repo errors (pipeline protection)', async () => {
        suggestionRepo.findOne.mockResolvedValue(suggestion);
        learningRepo.find.mockRejectedValue(new Error('db down'));

        const result = await useCase.execute(mkFeedback());

        expect(result).toBeNull();
    });
});
