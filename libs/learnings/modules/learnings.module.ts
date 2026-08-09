import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreateLearningUseCase } from '@libs/learnings/application/use-cases/create-learning.use-case';
import { DeleteLearningUseCase } from '@libs/learnings/application/use-cases/delete-learning.use-case';
import { DeriveLearningsUseCase } from '@libs/learnings/application/use-cases/derive-learnings.use-case';
import { GetLearningUseCase } from '@libs/learnings/application/use-cases/get-learning.use-case';
import { ListLearningStatsUseCase } from '@libs/learnings/application/use-cases/list-learning-stats.use-case';
import { ListLearningsUseCase } from '@libs/learnings/application/use-cases/list-learnings.use-case';
import { SupersedeLearningUseCase } from '@libs/learnings/application/use-cases/supersede-learning.use-case';
import { LEARNINGS_REPOSITORY_TOKEN } from '@libs/learnings/domain/contracts/learnings.repository';
import { LearningDeriver } from '@libs/learnings/domain/interfaces/learning-deriver.interface';

import { LearningsDeriverConsumer } from '../infrastructure/consumers/learnings-deriver.consumer';
import { HttpLearningDeriver } from '../infrastructure/derivers/http-learning-deriver';
import { LearningsRepository } from '../infrastructure/adapters/repositories/learnings.repository';
import { LearningModel } from '../infrastructure/adapters/repositories/schemas/learning.model';

export const LEARNING_DERIVER_TOKEN = Symbol.for('LearningDeriver');

@Module({
    imports: [TypeOrmModule.forFeature([LearningModel])],
    providers: [
        {
            provide: LEARNINGS_REPOSITORY_TOKEN,
            useClass: LearningsRepository,
        },
        {
            // Deriver pluggable: Honcho cloud si hay HONCHO_API_KEY, si no el
            // LLM local (HTTP OpenAI-compatible). El adapter de Honcho se
            // implementa en T11 sin tocar el resto del módulo.
            provide: LEARNING_DERIVER_TOKEN,
            useFactory: (env: NodeJS.ProcessEnv): LearningDeriver => {
                if (env.HONCHO_API_KEY) {
                    throw new Error(
                        'Honcho deriver aún no implementado — usá el deriver local (sin HONCHO_API_KEY)',
                    );
                }
                return new HttpLearningDeriver(env);
            },
            inject: [],
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
        {
            provide: DeriveLearningsUseCase,
            useFactory: (repo, deriver) =>
                new DeriveLearningsUseCase(repo, deriver),
            inject: [LEARNINGS_REPOSITORY_TOKEN, LEARNING_DERIVER_TOKEN],
        },
        LearningsDeriverConsumer,
    ],
    exports: [
        LEARNINGS_REPOSITORY_TOKEN,
        LEARNING_DERIVER_TOKEN,
        CreateLearningUseCase,
        ListLearningsUseCase,
        GetLearningUseCase,
        ListLearningStatsUseCase,
        SupersedeLearningUseCase,
        DeleteLearningUseCase,
        DeriveLearningsUseCase,
        LearningsDeriverConsumer,
    ],
})
export class LearningsModule {}
