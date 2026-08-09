import { randomUUID } from 'crypto';

import {
    ILearningsRepository,
} from '@libs/learnings/domain/contracts/learnings.repository';
import {
    ILearning,
    LearningCreatedBy,
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

export interface CreateLearningInput {
    organizationId: string;
    repositoryId: string;
    content: string;
    kind?: LearningKind;
    confidence?: ILearning['confidence'];
    sourceType?: LearningSourceType;
    sourceRef?: string | null;
    sourceUrl?: string | null;
    createdBy?: LearningCreatedBy;
}

export class CreateLearningUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
    ) {}

    async execute(input: CreateLearningInput): Promise<ILearning> {
        const content = input.content?.trim();
        if (!content) {
            throw new Error('El contenido del learning no puede estar vacío');
        }
        if (!input.organizationId || !input.repositoryId) {
            throw new Error('organizationId y repositoryId son requeridos');
        }

        const now = new Date();
        const learning: ILearning = {
            id: randomUUID(),
            organizationId: input.organizationId,
            repositoryId: input.repositoryId,
            content,
            kind: input.kind ?? LearningKind.CONVENTION,
            confidence: input.confidence ?? 'medium',
            sourceType: input.sourceType ?? LearningSourceType.MANUAL,
            sourceRef: input.sourceRef ?? null,
            sourceUrl: input.sourceUrl ?? null,
            status: LearningStatus.ACTIVE,
            supersedesId: null,
            createdBy: input.createdBy ?? 'human',
            createdAt: now,
            updatedAt: now,
        };

        return this.learningsRepository.create(learning);
    }
}
