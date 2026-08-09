import { DeriveLearningsUseCase } from './derive-learnings.use-case';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('DeriveLearningsUseCase', () => {
    const existing = {
        id: 'old-1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'Version vieja',
        kind: LearningKind.CONVENTION,
        confidence: 'medium',
        sourceType: LearningSourceType.PR,
        sourceRef: '#1000',
        sourceUrl: null,
        status: LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const repo = {
        find: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
    };
    const deriver = { respond: jest.fn() };
    const useCase = new DeriveLearningsUseCase(repo as any, deriver as any);

    beforeEach(() => jest.clearAllMocks());

    it('creates learnings from a PR event', async () => {
        repo.find.mockResolvedValue([]);
        repo.create.mockImplementation(async (l: any) => l);
        deriver.respond.mockResolvedValue(
            JSON.stringify([
                {
                    kind: 'convention',
                    content: 'Usar convenciones del repo',
                    confidence: 'high',
                    supersede_ids: [],
                },
            ]),
        );

        const result = await useCase.execute({
            repositoryId: 'repo-1',
            organizationId: 'org-1',
            sourceType: 'pr',
            sourceRef: '#1140',
            messages: ['PR: fix onboarding', 'diff: backend.py'],
        });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Usar convenciones del repo');
        expect(result[0].sourceRef).toBe('#1140');
        expect(result[0].sourceType).toBe(LearningSourceType.PR);
        expect(result[0].createdBy).toBe('system');
        expect(result[0].status).toBe(LearningStatus.ACTIVE);
        // El prompt incluye los learnings activos (contexto de refinamiento)
        const prompt = deriver.respond.mock.calls[0][0];
        expect(prompt).toContain('(ninguno)');
        expect(prompt).toContain('#1140');
    });

    it('parses JSON wrapped in code fences', async () => {
        repo.find.mockResolvedValue([]);
        repo.create.mockImplementation(async (l: any) => l);
        deriver.respond.mockResolvedValue(
            '```json\n[{"kind":"decision","content":"x","confidence":"medium","supersede_ids":[]}]\n```',
        );

        const result = await useCase.execute({
            repositoryId: 'repo-1',
            organizationId: 'org-1',
            sourceType: 'review',
            sourceRef: '#1141',
            messages: ['review ok'],
        });

        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe(LearningKind.DECISION);
    });

    it('supersedes learnings the deriver marks as outdated', async () => {
        repo.find.mockResolvedValue([existing]);
        repo.findById.mockResolvedValue(existing);
        repo.save.mockImplementation(async (l: any) => l);
        repo.create.mockImplementation(async (l: any) => l);
        deriver.respond.mockResolvedValue(
            JSON.stringify([
                {
                    kind: 'convention',
                    content: 'Version nueva que refina',
                    confidence: 'high',
                    supersede_ids: ['old-1'],
                },
            ]),
        );

        await useCase.execute({
            repositoryId: 'repo-1',
            organizationId: 'org-1',
            sourceType: 'pr',
            sourceRef: '#1142',
            messages: ['PR nuevo'],
        });

        // El viejo quedó superseded y el nuevo apunta a él
        const savedOld = repo.save.mock.calls[0][0];
        expect(savedOld.status).toBe(LearningStatus.SUPERSEDED);
        const created = repo.create.mock.calls[0][0];
        expect(created.supersedesId).toBe('old-1');
    });

    it('skips noise learnings', async () => {
        repo.find.mockResolvedValue([]);
        repo.create.mockImplementation(async (l: any) => l);
        deriver.respond.mockResolvedValue(
            JSON.stringify([
                { kind: 'noise', content: 'trivial', confidence: 'low', supersede_ids: [] },
                { kind: 'convention', content: 'real', confidence: 'high', supersede_ids: [] },
            ]),
        );

        const result = await useCase.execute({
            repositoryId: 'repo-1',
            organizationId: 'org-1',
            sourceType: 'pr',
            sourceRef: '#1143',
            messages: ['x'],
        });

        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('real');
    });

    it('returns empty when there are no messages', async () => {
        const result = await useCase.execute({
            repositoryId: 'repo-1',
            organizationId: 'org-1',
            sourceType: 'pr',
            sourceRef: '#1144',
            messages: [],
        });

        expect(result).toEqual([]);
        expect(deriver.respond).not.toHaveBeenCalled();
    });

    it('throws on unparseable LLM output (caller must catch)', async () => {
        repo.find.mockResolvedValue([]);
        deriver.respond.mockResolvedValue('esto no es json');

        await expect(
            useCase.execute({
                repositoryId: 'repo-1',
                organizationId: 'org-1',
                sourceType: 'pr',
                sourceRef: '#1145',
                messages: ['x'],
            }),
        ).rejects.toThrow('no se pudo parsear');
    });
});
