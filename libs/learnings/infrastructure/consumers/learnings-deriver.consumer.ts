import {
    RabbitSubscribe,
    MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

import { createLogger } from '@libs/core/log/logger';
import { DeriveLearningsUseCase } from '@libs/learnings/application/use-cases/derive-learnings.use-case';
import { createRabbitMQErrorHandlerWithFallback } from '@libs/core/infrastructure/queue/rabbitmq-error.handler';

interface StageCompletedEvent {
    stageName?: string;
    eventType?: string;
    result?: any;
    workflowJobId?: string;
    correlationId?: string;
}

/**
 * Consume stage.completed.* del pipeline de code-review y deriva learnings
 * del resultado de la review (PR con findings de Kody/CodeRabbit).
 *
 * HARD RULE: este handler NUNCA rompe el pipeline — todo va en try/catch,
 * siempre ACK, y ante cualquier dato faltante simplemente se saltea.
 */
@Injectable()
export class LearningsDeriverConsumer {
    private readonly logger = createLogger(LearningsDeriverConsumer.name);

    constructor(
        private readonly deriveLearningsUseCase: DeriveLearningsUseCase,
    ) {}

    @RabbitSubscribe({
        exchange: 'workflow.events',
        routingKey: 'stage.completed.*',
        queue: 'workflow.events.learnings.deriver',
        allowNonJsonMessages: false,
        errorBehavior: MessageHandlerErrorBehavior.ACK,
        errorHandler: createRabbitMQErrorHandlerWithFallback(
            'workflow.events.learnings.dlq',
        ),
        queueOptions: {
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': 'workflow.events.dlx',
                'x-dead-letter-routing-key': 'workflow.events.learnings.dlq',
            },
        },
    })
    async onStageCompleted(
        event: StageCompletedEvent,
        amqpMsg: ConsumeMessage,
    ): Promise<void> {
        const correlationId =
            amqpMsg?.properties?.headers?.['x-correlation-id'] ||
            event?.correlationId;

        try {
            // Solo nos interesan las reviews completadas.
            if (event?.eventType !== 'CODE_REVIEW') {
                return;
            }

            const payload = this.extractPayload(event?.result);
            if (!payload) {
                this.logger.debug({
                    message: 'Learnings: sin payload derivable, skip',
                    context: LearningsDeriverConsumer.name,
                    metadata: { correlationId },
                });
                return;
            }

            const created = await this.deriveLearningsUseCase.execute({
                repositoryId: payload.repositoryId,
                organizationId: payload.organizationId,
                sourceType: payload.sourceType,
                sourceRef: payload.sourceRef,
                sourceUrl: payload.sourceUrl,
                messages: payload.messages,
            });

            this.logger.log({
                message: `Learnings: ${created.length} derivados de ${payload.sourceRef}`,
                context: LearningsDeriverConsumer.name,
                metadata: { correlationId, count: created.length },
            });
        } catch (error) {
            // Nunca romper el pipeline de review: log + ACK (errorBehavior ACK).
            this.logger.error({
                message: 'Learnings deriver falló (skipped, no rompe pipeline)',
                context: LearningsDeriverConsumer.name,
                error: error instanceof Error ? error.message : error,
                metadata: { correlationId },
            });
        }
    }

    /**
     * Extrae el payload derivable del result del stage, tolerando las
     * distintas formas que puede tener (result directo o anidado).
     */
    private extractPayload(result: any): {
        repositoryId: string;
        organizationId: string;
        sourceType: 'pr' | 'review' | 'coderabbit';
        sourceRef: string;
        sourceUrl?: string | null;
        messages: string[];
    } | null {
        if (!result || typeof result !== 'object') return null;

        const repositoryId =
            result.repositoryId ?? result.repository?.id ?? result.repoId;
        const organizationId =
            result.organizationId ?? result.organization?.id ?? result.teamId;
        const prNumber =
            result.pullRequestNumber ??
            result.prNumber ??
            result.pullRequest?.number;

        if (!repositoryId || !organizationId || !prNumber) {
            return null;
        }

        const sourceType = result.sourceType === 'coderabbit' ? 'coderabbit' : 'review';
        const messages: string[] = [];

        if (result.title) messages.push(`PR title: ${result.title}`);
        if (result.reviewSummary || result.summary) {
            messages.push(`Review summary: ${result.reviewSummary ?? result.summary}`);
        }
        if (Array.isArray(result.suggestions) && result.suggestions.length > 0) {
            for (const s of result.suggestions.slice(0, 20)) {
                const label = s.label ?? s.severity ?? 'suggestion';
                const content = s.content ?? s.suggestionContent ?? '';
                if (content) messages.push(`[${label}] ${content}`);
            }
        }
        if (Array.isArray(result.findings) && result.findings.length > 0) {
            for (const f of result.findings.slice(0, 20)) {
                const content = f.message ?? f.content ?? '';
                if (content) messages.push(`[finding] ${content}`);
            }
        }

        if (messages.length === 0) {
            messages.push(JSON.stringify(result).slice(0, 2000));
        }

        return {
            repositoryId: String(repositoryId),
            organizationId: String(organizationId),
            sourceType,
            sourceRef: `#${prNumber}`,
            sourceUrl: result.pullRequestUrl ?? result.url ?? null,
            messages,
        };
    }
}
