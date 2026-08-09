import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreateLearningUseCase } from '@libs/learnings/application/use-cases/create-learning.use-case';
import { DeleteLearningUseCase } from '@libs/learnings/application/use-cases/delete-learning.use-case';
import { GetLearningUseCase } from '@libs/learnings/application/use-cases/get-learning.use-case';
import { ListLearningStatsUseCase } from '@libs/learnings/application/use-cases/list-learning-stats.use-case';
import { ListLearningsUseCase } from '@libs/learnings/application/use-cases/list-learnings.use-case';
import { SupersedeLearningUseCase } from '@libs/learnings/application/use-cases/supersede-learning.use-case';
import { LEARNINGS_REPOSITORY_TOKEN } from '@libs/learnings/domain/contracts/learnings.repository';

import { LearningsRepository } from '../infrastructure/adapters/repositories/learnings.repository';
import { LearningModel } from '../infrastructure/adapters/repositories/schemas/learning.model';

@Module({
    imports: [TypeOrmModule.forFeature([LearningModel])],
    providers: [
        {
            provide: LEARNINGS_REPOSITORY_TOKEN,
            useClass: LearningsRepository,
        },
        {
            provide: CreateLearningUseCase,
            useFactory: (repo) => new CreateLearningUseCase(repo),
            inject: [LEARNINGS_REPOSITORY_TOKEN],
        },
        {
            provide: ListLearningsUseCase,
            useFactory: (repo) => new ListLearningsUseCase(repo),
            inject: [LEARNINGS_REPOSITORY_TOKEN],
        },
        {
            provide: GetLearningUseCase,
            useFactory: (repo) => new GetLearningUseCase(repo),
            inject: [LEARNINGS_REPOSITORY_TOKEN],
        },
        {
            provide: ListLearningStatsUseCase,
            useFactory: (repo) => new ListLearningStatsUseCase(repo),
            inject: [LEARNINGS_REPOSITORY_TOKEN],
        },
        {
            provide: SupersedeLearningUseCase,
            useFactory: (repo) => new SupersedeLearningUseCase(repo),
            inject: [LEARNINGS_REPOSITORY_TOKEN],
        },
        {
            provide: DeleteLearningUseCase,
            useFactory: (repo) => new DeleteLearningUseCase(repo),
            inject: [LEARNINGS_REPOSITORY_TOKEN],
        },
    ],
    exports: [
        LEARNINGS_REPOSITORY_TOKEN,
        CreateLearningUseCase,
        ListLearningsUseCase,
        GetLearningUseCase,
        ListLearningStatsUseCase,
        SupersedeLearningUseCase,
        DeleteLearningUseCase,
    ],
})
export class LearningsModule {}
