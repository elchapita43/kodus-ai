import { ILearningsRepository } from '@libs/learnings/domain/contracts/learnings.repository';
import { LearningStatus } from '@libs/learnings/domain/interfaces/learning.interface';

export class DeleteLearningUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
    ) {}

    /**
     * Soft delete: marca `superseded` (nunca borrado físico — consistente con
     * el modelo de conclusiones que se refinan, no se eliminan).
     */
    async execute(id: string, organizationId: string): Promise<void> {
        const existing = await this.learningsRepository.findById(id);
        if (!existing || existing.organizationId !== organizationId) {
            throw new Error('Learning no encontrado');
        }

        await this.learningsRepository.save({
            ...existing,
            status: LearningStatus.SUPERSEDED,
            updatedAt: new Date(),
        });
    }
}
