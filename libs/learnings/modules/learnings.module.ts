import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LEARNINGS_REPOSITORY_TOKEN } from '@libs/learnings/domain/contracts/learnings.repository';

import { LearningsRepository } from './adapters/repositories/learnings.repository';
import { LearningModel } from './adapters/repositories/schemas/learning.model';

@Module({
    imports: [TypeOrmModule.forFeature([LearningModel])],
    providers: [
        {
            provide: LEARNINGS_REPOSITORY_TOKEN,
            useClass: LearningsRepository,
        },
    ],
    exports: [LEARNINGS_REPOSITORY_TOKEN],
})
export class LearningsModule {}
