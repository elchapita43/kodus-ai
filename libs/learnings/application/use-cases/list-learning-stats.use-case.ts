import {
    ILearningsRepository,
    ListLearningsFilter,
} from '@libs/learnings/domain/contracts/learnings.repository';
import { LearningStatus } from '@libs/learnings/domain/interfaces/learning.interface';

export interface LearningStats {
    total: number;
    active: number;
    superseded: number;
    byKind: Record<string, number>;
    bySource: Record<string, number>;
}

export class ListLearningStatsUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
    ) {}

    async execute(
        filter: Omit<ListLearningsFilter, 'status' | 'kind' | 'sourceType'>,
    ): Promise<LearningStats> {
        const baseFilter = {
            organizationId: filter.organizationId,
            repositoryId: filter.repositoryId,
        };

        const [total, active, superseded, all] = await Promise.all([
            this.learningsRepository.count(baseFilter),
            this.learningsRepository.count({
                ...baseFilter,
                status: LearningStatus.ACTIVE,
            }),
            this.learningsRepository.count({
                ...baseFilter,
                status: LearningStatus.SUPERSEDED,
            }),
            this.learningsRepository.find({ ...baseFilter, limit: 1000 }),
        ]);

        const byKind: Record<string, number> = {};
        const bySource: Record<string, number> = {};

        for (const l of all) {
            byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
            bySource[l.sourceType] = (bySource[l.sourceType] ?? 0) + 1;
        }

        return { total, active, superseded, byKind, bySource };
    }
}
