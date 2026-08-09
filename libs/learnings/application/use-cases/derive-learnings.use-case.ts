import { randomUUID } from 'crypto';

import {
    ILearningsRepository,
} from '@libs/learnings/domain/contracts/learnings.repository';
import {
    DeriveLearningEvent,
    DerivedLearning,
    LearningDeriver,
} from '@libs/learnings/domain/interfaces/learning-deriver.interface';
import {
    ILearning,
    LearningKind,
    LearningSourceType,
    LearningStatus,
} from '@libs/learnings/domain/interfaces/learning.interface';

const PROMPT_TEMPLATE = `Sos el sistema de memoria de un code-reviewer AI. Aprendés qué cosas se hacen y qué cosas NO se hacen en un repositorio.

Analizá el evento de abajo (PR/review/feedback) y extraé los learnings accionables: convenciones, decisiones, preferencias del equipo, cosas intentadas que fallaron.

Reglas:
- SOLO learnings que sirvan para futuros reviews (no repitas el contenido del evento).
- Marcá "noise" lo trivial que no aporta.
- Si un learning nuevo contradice o refina uno existente, incluí su id en supersede_ids.
- Respondé SOLO un JSON array, sin markdown ni texto extra:
[{"kind":"convention|decision|preference|noise|attempted","content":"...","confidence":"high|medium|low","supersede_ids":["id-opcional"]}]

Learnings activos actuales (para refinar, no repetir):
{ACTIVE_LEARNINGS}

Evento (source {SOURCE_TYPE} {SOURCE_REF}):
{MESSAGES}`;

const parseDerived = (raw: string): DerivedLearning[] => {
    let text = raw.trim();
    // Strip ```json fences si el modelo las agrega
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`Deriver: no se pudo parsear JSON: ${raw.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) {
        throw new Error('Deriver: respuesta no es un array');
    }
    return parsed;
};

export class DeriveLearningsUseCase {
    constructor(
        private readonly learningsRepository: ILearningsRepository,
        private readonly deriver: LearningDeriver,
    ) {}

    async execute(event: DeriveLearningEvent): Promise<ILearning[]> {
        if (!event.messages?.length) {
            return [];
        }

        const active = await this.learningsRepository.find({
            organizationId: event.organizationId,
            repositoryId: event.repositoryId,
            status: LearningStatus.ACTIVE,
            limit: 50,
        });
        const activeBlock = active
            .map((l) => `- [${l.id}] (${l.kind}) ${l.content}`)
            .join('\n');

        const prompt = PROMPT_TEMPLATE
            .replace('{ACTIVE_LEARNINGS}', activeBlock || '(ninguno)')
            .replace('{SOURCE_TYPE}', event.sourceType)
            .replace('{SOURCE_REF}', event.sourceRef)
            .replace('{MESSAGES}', event.messages.join('\n---\n'));

        const raw = await this.deriver.respond(prompt);
        const derived = parseDerived(raw);

        const now = new Date();
        const created: ILearning[] = [];

        for (const d of derived) {
            if (d.kind === 'noise') continue;

            // Supersede: los ids que el deriver marcó pasan a superseded.
            for (const supersedeId of d.supersede_ids ?? []) {
                const existing = await this.learningsRepository.findById(
                    supersedeId,
                );
                if (existing && existing.organizationId === event.organizationId) {
                    await this.learningsRepository.save({
                        ...existing,
                        status: LearningStatus.SUPERSEDED,
                        updatedAt: now,
                    });
                }
            }

            created.push(
                await this.learningsRepository.create({
                    id: randomUUID(),
                    organizationId: event.organizationId,
                    repositoryId: event.repositoryId,
                    content: d.content,
                    kind: (d.kind as LearningKind) ?? LearningKind.CONVENTION,
                    confidence: d.confidence,
                    sourceType: event.sourceType as LearningSourceType,
                    sourceRef: event.sourceRef,
                    sourceUrl: event.sourceUrl ?? null,
                    status: LearningStatus.ACTIVE,
                    supersedesId: (d.supersede_ids ?? [])[0] ?? null,
                    createdBy: 'system',
                    createdAt: now,
                    updatedAt: now,
                }),
            );
        }

        return created;
    }
}
