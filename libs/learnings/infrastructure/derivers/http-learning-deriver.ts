import { LearningDeriver } from '@libs/learnings/domain/interfaces/learning-deriver.interface';

/**
 * Deriver concreto: llama a un endpoint OpenAI-compatible (chat completions)
 * con el modelo configurable por env. No depende del stack langchain del repo
 * para mantener el path de learnings aislado y fácil de testear.
 *
 * Env:
 *   LEARNINGS_LLM_BASE_URL  (default https://api.openai.com/v1)
 *   LEARNINGS_LLM_API_KEY   (fallback: OPENAI_API_KEY, luego API_OPEN_AI_API_KEY del stack Codus)
 *   LEARNINGS_LLM_MODEL     (default gpt-4o-mini)
 */
export class HttpLearningDeriver implements LearningDeriver {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly model: string;

    constructor(env: NodeJS.ProcessEnv = process.env) {
        this.baseUrl = (
            env.LEARNINGS_LLM_BASE_URL ?? 'https://api.openai.com/v1'
        ).replace(/\/$/, '');
        this.apiKey =
            env.LEARNINGS_LLM_API_KEY ??
            env.OPENAI_API_KEY ??
            env.API_OPEN_AI_API_KEY ??
            '';
        this.model = env.LEARNINGS_LLM_MODEL ?? 'gpt-4o-mini';
    }

    async respond(prompt: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error(
                'LEARNINGS_LLM_API_KEY (o OPENAI_API_KEY) no configurada para el deriver de learnings',
            );
        }

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(
                `Deriver LLM error ${res.status}: ${body.slice(0, 300)}`,
            );
        }

        const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Deriver LLM: respuesta vacía');
        }
        return content;
    }
}
