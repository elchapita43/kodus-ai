import { randomUUID } from 'crypto';

import {
    ILearningsRepository,
} from '@libs/learnings/domain/contracts/learnings.repository';
import {
    ILearning,
    LearningKind,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

export class SupersedeLearningUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
    ) {}

    /**
     * Refina un learning: el viejo pasa a `superseded` y el nuevo lo reemplaza
     * (nunca se borra el historial — patrón honcho de conclusiones).
     */
    async execute(
        id: string,
        organizationId: string,
        newContent: string,
    ): Promise<ILearning> {
        const existing = await this.learningsRepository.findById(id);
        if (!existing || existing.organizationId !== organizationId) {
            throw new Error('Learning no encontrado');
        }

        const content = newContent?.trim();
        if (!content) {
            throw new Error('El contenido del learning no puede estar vacío');
        }

        const now = new Date();
        const replacement: ILearning = {
            id: randomUUID(),
            organizationId: existing.organizationId,
            repositoryId: existing.repositoryId,
            content,
            kind: existing.kind,
            confidence: existing.confidence,
            sourceType: existing.sourceType,
            sourceRef: existing.sourceRef,
            sourceUrl: existing.sourceUrl,
            status: LearningStatus.ACTIVE,
            supersedesId: existing.id,
            createdBy: 'human',
            createdAt: now,
            updatedAt: now,
        };

        await this.learningsRepository.save({
            ...existing,
            status: LearningStatus.SUPERSEDED,
            updatedAt: now,
        });

        return this.learningsRepository.create(replacement);
    }
}

// Re-export para conveniencia del controlador (kind no se usa en supersede
// pero se mantiene el import para futuras extensiones).
export type { LearningKind };
