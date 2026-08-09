import { ILike } from 'typeorm';

import { LearningsRepository } from './learnings.repository';
import { LearningModel } from './schemas/learning.model';
import {
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

describe('LearningsRepository', () => {
    const learning: LearningModel = {
        uuid: 'learning-1',
        organizationId: 'org-1',
        repositoryId: 'repo-1',
        content: 'No commitear .env con secrets reales',
        kind: LearningKind.CONVENTION,
        confidence: 'high',
        sourceType: LearningSourceType.MANUAL,
        sourceRef: null,
        sourceUrl: null,
        status: LearningStatus.ACTIVE,
        supersedesId: null,
        createdBy: 'human',
        createdAt: new Date('2026-08-09T00:00:00Z'),
        updatedAt: new Date('2026-08-09T00:00:00Z'),
    } as LearningModel;

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
    };

    const repo = new LearningsRepository(mockRepository as any);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates and maps a learning back to domain', async () => {
        mockRepository.create.mockReturnValue(learning);
        mockRepository.save.mockResolvedValue(learning);

        const result = await repo.create({
            id: 'learning-1',
            organizationId: 'org-1',
            repositoryId: 'repo-1',
            content: 'No commitear .env con secrets reales',
            kind: LearningKind.CONVENTION,
            confidence: 'high',
            sourceType: LearningSourceType.MANUAL,
            sourceRef: null,
            sourceUrl: null,
            status: LearningStatus.ACTIVE,
            supersedesId: null,
            createdBy: 'human',
            createdAt: new Date('2026-08-09T00:00:00Z'),
            updatedAt: new Date('2026-08-09T00:00:00Z'),
        });

        expect(result.id).toBe('learning-1');
        expect(result.repositoryId).toBe('repo-1');
        expect(mockRepository.save).toHaveBeenCalled();
    });

    it('finds by id and returns null when missing', async () => {
        mockRepository.findOne.mockResolvedValue(learning);
        const found = await repo.findById('learning-1');
        expect(found?.content).toBe('No commitear .env con secrets reales');

        mockRepository.findOne.mockResolvedValue(null);
        const missing = await repo.findById('nope');
        expect(missing).toBeNull();
    });

    it('builds filters with pagination and ILIKE search', async () => {
        mockRepository.find.mockResolvedValue([learning]);
        mockRepository.count.mockResolvedValue(1);

        const results = await repo.find({
            organizationId: 'org-1',
            repositoryId: 'repo-1',
            status: LearningStatus.ACTIVE,
            q: 'env',
            page: 2,
            limit: 10,
        });

        expect(results).toHaveLength(1);
        const findCall = mockRepository.find.mock.calls[0][0];
        expect(findCall.where.organizationId).toBe('org-1');
        expect(findCall.where.repositoryId).toBe('repo-1');
        expect(findCall.where.status).toBe(LearningStatus.ACTIVE);
        expect(findCall.where.content).toEqual(ILike('%env%'));
        expect(findCall.skip).toBe(10);
        expect(findCall.take).toBe(10);
    });

    it('counts with the same where filter', async () => {
        mockRepository.count.mockResolvedValue(3);
        const total = await repo.count({ organizationId: 'org-1' });
        expect(total).toBe(3);
        expect(mockRepository.count.mock.calls[0][0].where.organizationId).toBe(
            'org-1',
        );
    });
});
