import {
    ILearningsRepository,
    ListLearningsFilter,
} from '@libs/learnings/domain/contracts/learnings.repository';
import { ILearning } from '@libs/learnings/domain/interfaces/learning.interface';

export interface ListLearningsResult {
    items: ILearning[];
    total: number;
    page: number;
    limit: number;
}

export class ListLearningsUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
    ) {}

    async execute(
        filter: ListLearningsFilter,
    ): Promise<ListLearningsResult> {
        if (!filter.organizationId) {
            throw new Error('organizationId es requerido');
        }

        const page = filter.page ?? 1;
        const limit = filter.limit ?? 20;

        const [items, total] = await Promise.all([
            this.learningsRepository.find({ ...filter, page, limit }),
            this.learningsRepository.count({ ...filter, page: undefined, limit: undefined }),
        ]);

        return { items, total, page, limit };
    }
}
