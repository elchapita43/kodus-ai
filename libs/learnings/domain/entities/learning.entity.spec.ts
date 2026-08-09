import { LearningEntity } from './learning.entity';
import { LearningKind, LearningStatus, LearningSourceType } from '../interfaces/learning.interface';

describe('LearningEntity', () => {
    const base = {
        id: 'learning-1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'No commitear .env con secrets reales',
        kind: LearningKind.CONVENTION,
        confidence: 'high' as const,
        sourceType: LearningSourceType.MANUAL,
        sourceRef: null,
        sourceUrl: null,
        status: LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'human' as const,
        createdAt: new Date('2026-08-09T00:00:00Z'),
        updatedAt: new Date('2026-08-09T00:00:00Z'),
    };

    it('creates a learning with all fields', () => {
        const entity = LearningEntity.create(base);
        const json = entity.toJson();
        expect(json.id).toBe('learning-1');
        expect(json.organizationId).toBe('org-1');
        expect(json.repositoryId).toBe('repo-1');
        expect(json.content).toBe('No commitear .env con secrets reales');
        expect(json.kind).toBe(LearningKind.CONVENTION);
        expect(json.sourceType).toBe(LearningSourceType.MANUAL);
        expect(json.createdBy).toBe('human');
    });

    it('defaults status to active when not provided', () => {
        const entity = LearningEntity.create({ ...base, status: undefined as any });
        expect(entity.toJson().status).toBe(LearningStatus.ACTIVE);
    });

    it('normalizes null source ref/url for manual learnings', () => {
        const entity = LearningEntity.create(base);
        const json = entity.toJson();
        expect(json.sourceRef).toBeNull();
        expect(json.sourceUrl).toBeNull();
    });

    it('round-trips through toObject', () => {
        const entity = LearningEntity.create(base);
        expect(entity.toObject()).toEqual(base);
    });

    it('exposes getters for the key fields', () => {
        const entity = LearningEntity.create(base);
        expect(entity.id).toBe('learning-1');
        expect(entity.repositoryId).toBe('repo-1');
        expect(entity.status).toBe(LearningStatus.ACTIVE);
    });
});
