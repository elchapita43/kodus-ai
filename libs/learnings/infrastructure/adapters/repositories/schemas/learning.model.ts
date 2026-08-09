import { Column, Entity, Index } from 'typeorm';

import { CoreModel } from '@libs/core/infrastructure/repositories/model/typeOrm';

import {
    LearningConfidence,
    LearningCreatedBy,
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

@Entity('learnings')
@Index(['organizationId', 'repositoryId'])
@Index(['repositoryId', 'status'])
export class LearningModel extends CoreModel {
    @Column()
    organizationId: string;

    @Column()
    repositoryId: string;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'enum', enum: LearningKind })
    kind: LearningKind;

    @Column({ type: 'varchar', default: 'medium' })
    confidence: LearningConfidence;

    @Column({ type: 'enum', enum: LearningSourceType })
    sourceType: LearningSourceType;

    @Column({ type: 'varchar', nullable: true })
    sourceRef: string | null;

    @Column({ type: 'varchar', nullable: true })
    sourceUrl: string | null;

    @Column({ type: 'enum', enum: LearningStatus, default: LearningStatus.ACTIVE })
    status: LearningStatus;

    @Column({ type: 'uuid', nullable: true })
    supersedesId: string | null;

    @Column({ type: 'enum', enum: ['system', 'human'], default: 'system' })
    createdBy: LearningCreatedBy;
}
