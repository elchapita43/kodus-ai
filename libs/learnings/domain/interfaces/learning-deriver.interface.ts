/**
 * Deriver de learnings: extrae conclusiones (learnings) de los eventos del
 * repo (PRs, reviews, feedback). La implementación es INYECTABLE — en tests
 * se usa un stub sin red; en runtime se conecta al LLM del stack (o a Honcho
 * cuando haya HONCHO_API_KEY).
 */
export interface LearningDeriver {
    respond(prompt: string): Promise<string>;
}

export interface DeriveLearningEvent {
    repositoryId: string;
    organizationId: string;
    sourceType: 'pr' | 'review' | 'coderabbit' | 'issue';
    sourceRef: string; // ej. "#1140"
    sourceUrl?: string | null;
    messages: string[]; // título PR, resumen diff, comentarios, findings
}

export interface DerivedLearning {
    kind: 'convention' | 'decision' | 'preference' | 'noise' | 'attempted';
    content: string;
    confidence: 'high' | 'medium' | 'low';
    supersede_ids?: string[];
}
