import { ILearningsRepository } from '@libs/learnings/domain/contracts/learnings.repository';
import { ILearning } from '@libs/learnings/domain/interfaces/learning.interface';

export class GetLearningUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
    ) {}

    async execute(id: string, organizationId: string): Promise<ILearning> {
        const learning = await this.learningsRepository.findById(id);
        if (!learning) {
            throw new Error('Learning no encontrado');
        }
        // Scope: el learning debe pertenecer a la org del usuario.
        if (learning.organizationId !== organizationId) {
            throw new Error('Learning no encontrado');
        }
        return learning;
    }
}
