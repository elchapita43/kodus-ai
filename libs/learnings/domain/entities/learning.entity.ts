import { Entity } from '@libs/core/domain/interfaces/entity';

import {
    ILearning,
    LearningStatus,
} from '../interfaces/learning.interface';

export class LearningEntity implements Entity<ILearning> {
    private readonly _id: string;
    private readonly _organizationId: string;
    private readonly _repositoryId: string;
    private readonly _content: string;
    private readonly _kind: ILearning['kind'];
    private readonly _confidence: ILearning['confidence'];
    private readonly _sourceType: ILearning['sourceType'];
    private readonly _sourceRef: string | null;
    private readonly _sourceUrl: string | null;
    private readonly _status: LearningStatus;
    private readonly _supersedesId: string | null;
    private readonly _createdBy: ILearning['createdBy'];
    private readonly _createdAt: Date;
    private readonly _updatedAt: Date;

    constructor(learning: ILearning) {
        this._id = learning.id;
        this._organizationId = learning.organizationId;
        this._repositoryId = learning.repositoryId;
        this._content = learning.content;
        this._kind = learning.kind;
        this._confidence = learning.confidence;
        this._sourceType = learning.sourceType;
        this._sourceRef = learning.sourceRef ?? null;
        this._sourceUrl = learning.sourceUrl ?? null;
        this._status = learning.status ?? LearningStatus.ACTIVE;
        this._supersedesId = learning.supersedesId ?? null;
        this._createdBy = learning.createdBy;
        this._createdAt = learning.createdAt;
        this._updatedAt = learning.updatedAt;
    }

    toJson(): ILearning {
        return {
            id: this._id,
            organizationId: this._organizationId,
            repositoryId: this._repositoryId,
            content: this._content,
            kind: this._kind,
            confidence: this._confidence,
            sourceType: this._sourceType,
            sourceRef: this._sourceRef,
            sourceUrl: this._sourceUrl,
            status: this._status,
            supersedesId: this._supersedesId,
            createdBy: this._createdBy,
            createdAt: this._createdAt,
            updatedAt: this._updatedAt,
        };
    }

    toObject(): ILearning {
        return this.toJson();
    }

    public static create(learning: ILearning): LearningEntity {
        return new LearningEntity(learning);
    }

    get id(): string {
        return this._id;
    }

    get repositoryId(): string {
        return this._repositoryId;
    }

    get status(): LearningStatus {
        return this._status;
    }
}
