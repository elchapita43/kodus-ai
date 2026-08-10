import { randomUUID } from 'crypto';

import { ILearningsRepository } from '@libs/learnings/domain/contracts/learnings.repository';
import { ISuggestionEmbeddedRepository } from '@libs/codyFineTuning/domain/suggestionEmbedded/contracts/suggestionEmbedded.repository.contract';
import {
    ILearning,
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

export interface HumanFeedbackEvent {
    organizationId: string;
    reactions: { thumbsUp: number; thumbsDown: number };
    suggestionId: string;
    pullRequest: {
        id: string;
        number: number;
        repository: { id: string; fullName: string };
    };
}

/**
 * Aprende del feedback humano: cuando el equipo reacciona (👍/👎) a una
 * sugerencia de review, se deriva un learning con el veredicto humano como
 * fuente de verdad — no la interpretación automática del LLM.
 *
 *   👍 sola  → convention: "El equipo aprobó: <sugerencia>"
 *   👎 sola  → attempted:  "El equipo rechazó: <sugerencia>"
 *   ambas    → ambivalente, skip
 *
 * HARD RULE: nunca rompe el flujo de feedback — todo en try/catch.
 */
export class LearnFromHumanFeedbackUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
        private readonly suggestionRepository: ISuggestionEmbeddedRepository,
    ) {}

    async execute(event: HumanFeedbackEvent): Promise<ILearning | null> {
        try {
            const { thumbsUp, thumbsDown } = event.reactions ?? {};

            if (!thumbsUp && !thumbsDown) return null;
            if (thumbsUp > 0 && thumbsDown > 0) return null;

            const approved = thumbsUp > 0;

            // Dedup: si ya existe un learning con el mismo origen y contenido
            // aproximado, no duplicar.
            const existing = await this.learningsRepository.find({
                organizationId: event.organizationId,
                repositoryId: event.pullRequest.repository.id,
                sourceType: LearningSourceType.REVIEW,
                sourceRef: `#${event.pullRequest.number}`,
                limit: 50,
            });
            if (existing.length > 0) {
                return null;
            }

            // Contenido de la sugerencia reaccionada (si está disponible).
            let suggestionContent: string | undefined;
            try {
                const suggestion =
                    await this.suggestionRepository.findOne(event.suggestionId);
                suggestionContent = suggestion?.suggestionContent;
            } catch {
                suggestionContent = undefined;
            }

            const content = suggestionContent
                ? `${approved ? 'El equipo aprobó' : 'El equipo rechazó'}: ${suggestionContent}`
                : approved
                  ? 'Sugerencia aprobada por el equipo en la review'
                  : 'Sugerencia rechazada por el equipo en la review';

            const now = new Date();
            const learning: ILearning = {
                id: randomUUID(),
                organizationId: event.organizationId,
                repositoryId: event.pullRequest.repository.id,
                content,
                kind: approved
                    ? LearningKind.CONVENTION
                    : LearningKind.ATTEMPTED,
                confidence: 'high',
                sourceType: LearningSourceType.REVIEW,
                sourceRef: `#${event.pullRequest.number}`,
                sourceUrl: null,
                status: LearningStatus.ACTIVE,
                supersedesId: null,
                createdBy: 'human',
                createdAt: now,
                updatedAt: now,
            };

            return await this.learningsRepository.create(learning);
        } catch {
            // Nunca romper el flujo de feedback del code review.
            return null;
        }
    }
}
