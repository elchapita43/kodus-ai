export enum LearningKind {
    CONVENTION = 'convention',
    DECISION = 'decision',
    PREFERENCE = 'preference',
    NOISE = 'noise',
    ATTEMPTED = 'attempted',
}

export enum LearningStatus {
    ACTIVE = 'active',
    SUPERSEDED = 'superseded',
}

export enum LearningSourceType {
    PR = 'pr',
    ISSUE = 'issue',
    REVIEW = 'review',
    COMMIT = 'commit',
    MANUAL = 'manual',
    CODERABBIT = 'coderabbit',
}

export type LearningConfidence = 'high' | 'medium' | 'low';

export type LearningCreatedBy = 'system' | 'human';

export interface ILearning {
    id: string;
    organizationId: string;
    repositoryId: string;
    content: string;
    kind: LearningKind;
    confidence: LearningConfidence;
    sourceType: LearningSourceType;
    sourceRef: string | null;
    sourceUrl: string | null;
    status: LearningStatus;
    supersedesId: string | null;
    createdBy: LearningCreatedBy;
    createdAt: Date;
    updatedAt: Date;
}
