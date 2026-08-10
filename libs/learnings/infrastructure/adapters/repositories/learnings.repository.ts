import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { createLogger } from '@libs/core/log/logger';

import {
    ILearningsRepository,
    ListLearningsFilter,
} from '@libs/learnings/domain/contracts/learnings.repository';
import { ILearning } from '@libs/learnings/domain/interfaces/learning.interface';

import { LearningModel } from './schemas/learning.model';

const PAGE_SIZE_DEFAULT = 20;

const toModel = (learning: ILearning): Partial<LearningModel> => ({
    uuid: learning.id,
    organizationId: learning.organizationId,
    repositoryId: learning.repositoryId,
    content: learning.content,
    kind: learning.kind,
    confidence: learning.confidence,
    sourceType: learning.sourceType,
    sourceRef: learning.sourceRef,
    sourceUrl: learning.sourceUrl,
    status: learning.status,
    supersedesId: learning.supersedesId,
    createdBy: learning.createdBy,
});

const toDomain = (model: LearningModel): ILearning => ({
    id: model.uuid,
    organizationId: model.organizationId,
    repositoryId: model.repositoryId,
    content: model.content,
    kind: model.kind,
    confidence: model.confidence,
    sourceType: model.sourceType,
    sourceRef: model.sourceRef,
    sourceUrl: model.sourceUrl,
    status: model.status,
    supersedesId: model.supersedesId,
    createdBy: model.createdBy,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
});

@Injectable()
export class LearningsRepository implements ILearningsRepository {
    private readonly logger = createLogger(LearningsRepository.name);

    constructor(
        @InjectRepository(LearningModel)
        private readonly repository: Repository<LearningModel>,
    ) {}

    async create(learning: ILearning): Promise<ILearning> {
        const model = this.repository.create(toModel(learning));
        const saved = await this.repository.save(model);
        return toDomain(saved);
    }

    async save(learning: ILearning): Promise<ILearning> {
        const saved = await this.repository.save(toModel(learning));
        return toDomain(saved);
    }

    async findById(id: string): Promise<ILearning | null> {
        const model = await this.repository.findOne({ where: { uuid: id } });
        return model ? toDomain(model) : null;
    }

    async find(filter: ListLearningsFilter): Promise<ILearning[]> {
        const where = this.buildWhere(filter);
        const page = filter.page ?? 1;
        const limit = filter.limit ?? PAGE_SIZE_DEFAULT;

        const models = await this.repository.find({
            where,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return models.map(toDomain);
    }

    async count(filter: ListLearningsFilter): Promise<number> {
        return this.repository.count({ where: this.buildWhere(filter) });
    }

    private buildWhere(
        filter: ListLearningsFilter,
    ): FindOptionsWhere<LearningModel> {
        const where: FindOptionsWhere<LearningModel> = {
            organizationId: filter.organizationId,
        };

        if (filter.repositoryId) where.repositoryId = filter.repositoryId;
        if (filter.status) where.status = filter.status;
        if (filter.kind) where.kind = filter.kind;
        if (filter.sourceType) where.sourceType = filter.sourceType;
        if (filter.sourceRef) where.sourceRef = filter.sourceRef;
        if (filter.q) where.content = ILike(`%${filter.q}%`);

        return where;
    }
}
