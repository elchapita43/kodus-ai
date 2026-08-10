import {
    RabbitSubscribe,
    MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { createLogger } from '@libs/core/log/logger';
import { Injectable, Optional } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

import { SaveCodeReviewFeedbackUseCase } from '@libs/code-review/application/use-cases/codeReviewFeedback/save-feedback.use-case';
import { createRabbitMQErrorHandlerWithFallback } from '@libs/core/infrastructure/queue/rabbitmq-error.handler';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { LearnFromHumanFeedbackUseCase } from '@libs/learnings/application/use-cases/learn-from-human-feedback.use-case';

@Injectable()
export class CodeReviewFeedbackConsumer {
    private readonly logger = createLogger(CodeReviewFeedbackConsumer.name);
    private readonly handlerTimeoutMs = this.parseTimeoutMs(
        process.env.WORKFLOW_QUEUE_HANDLER_TIMEOUT_MS,
        60000,
    );
    constructor(
        private readonly saveCodeReviewFeedbackUseCase: SaveCodeReviewFeedbackUseCase,
        private readonly observability: ObservabilityService,
        // El aprendizaje por feedback humano es un hook opcional: si el
        // módulo de learnings no está montado, el flujo de feedback sigue
        // intacto.
        @Optional()
        private readonly learnFromHumanFeedbackUseCase?: LearnFromHumanFeedbackUseCase,
    ) {}

    @RabbitSubscribe({
        exchange: 'orchestrator.exchange.delayed',
        routingKey: 'codeReviewFeedback.syncCodeReviewReactions',
        queue: 'codeReviewFeedback.syncCodeReviewReactions.queue',
        allowNonJsonMessages: true,
        errorBehavior: MessageHandlerErrorBehavior.ACK,
        errorHandler: createRabbitMQErrorHandlerWithFallback(
            'codeReviewFeedback.syncCodeReviewReactions',
        ),
        queueOptions: {
            channel: 'channel-feedback',
            arguments: {
                'x-queue-type': 'quorum',
                'x-dead-letter-exchange': 'orchestrator.exchange.dlx',
                'x-dead-letter-routing-key':
                    'codeReviewFeedback.syncCodeReviewReactions',
            },
        },
    })
    async handleSyncCodeReviewReactions(message: any, amqpMsg: ConsumeMessage) {
        const payload = message?.payload;
        const headers = amqpMsg?.properties?.headers;
        const messageId = amqpMsg?.properties?.messageId;
        const correlationId =
            headers?.['x-correlation-id'] ||
            payload?.correlationId ||
            amqpMsg?.properties?.correlationId;
        const attempts = headers?.['x-attempts'];

        if (correlationId) {
            this.observability.setContext(correlationId);
        }

        return await this.observability.runInSpan(
            'code_review.feedback.sync',
            async (span) => {
                const startedAt = Date.now();
                this.logger.debug({
                    message: 'Code review feedback processing started',
                    context: CodeReviewFeedbackConsumer.name,
                    metadata: {
                        messageId,
                        correlationId,
                        attempts,
                        teamId: payload?.teamId,
                        organizationId: payload?.organizationId,
                    },
                });

                if (payload) {
                    span.setAttributes({
                        'code_review.team_id': payload.teamId,
                        'code_review.organization_id': payload.organizationId,
                        'code_review.correlation_id': correlationId,
                        'code_review.message_id': messageId,
                        ...(attempts !== undefined && {
                            'code_review.attempts': attempts,
                        }),
                    });

                    try {
                        const savedFeedbacks =
                            await this.withTimeout(
                                this.saveCodeReviewFeedbackUseCase.execute(
                                    payload,
                                ),
                                this.handlerTimeoutMs,
                                'syncCodeReviewReactions',
                            );

                        // Hook de aprendizaje: cada feedback nuevo guardado
                        // (reacción 👍/👎 humana a una sugerencia) alimenta el
                        // sistema de learnings. Nunca rompe el flujo — el
                        // use-case ya traga sus propios errores.
                        if (
                            this.learnFromHumanFeedbackUseCase &&
                            Array.isArray(savedFeedbacks) &&
                            savedFeedbacks.length > 0
                        ) {
                            for (const feedback of savedFeedbacks) {
                                try {
                                    const learning =
                                        await this.learnFromHumanFeedbackUseCase.execute(
                                            feedback.toJson(),
                                        );
                                    if (learning) {
                                        this.logger.debug({
                                            message: `Learning derivado de feedback humano: ${learning.kind} (${learning.sourceRef})`,
                                            context:
                                                CodeReviewFeedbackConsumer.name,
                                            metadata: {
                                                learningId: learning.id,
                                                suggestionId:
                                                    feedback.suggestionId,
                                                correlationId,
                                            },
                                        });
                                    }
                                } catch (hookError) {
                                    this.logger.warn({
                                        message:
                                            'Learning hook failed (skipped, feedback flow intact)',
                                        context:
                                            CodeReviewFeedbackConsumer.name,
                                        error:
                                            hookError instanceof Error
                                                ? hookError.message
                                                : hookError,
                                        metadata: { correlationId },
                                    });
                                }
                            }
                        }

                        const durationMs = Date.now() - startedAt;
                        this.logger.debug({
                            message: `Code review feedback processing for team ${payload.teamId} completed successfully.`,
                            context: CodeReviewFeedbackConsumer.name,
                            metadata: {
                                teamId: payload.teamId,
                                organizationId: payload.organizationId,
                                timestamp: new Date().toISOString(),
                                correlationId,
                                messageId,
                                durationMs,
                            },
                        });
                    } catch (error) {
                        span.setAttributes({
                            'error': true,
                            'exception.message': error.message,
                            'workflow.handler.timeout_ms':
                                this.handlerTimeoutMs,
                        });

                        this.logger.error({
                            message: `Error processing code review feedback for team ${payload.teamId}`,
                            context: CodeReviewFeedbackConsumer.name,
                            error: error.message,
                            metadata: {
                                teamId: payload.teamId,
                                organizationId: payload.organizationId,
                                timestamp: new Date().toISOString(),
                                correlationId,
                            },
                        });

                        throw error;
                    }
                } else {
                    span.setAttributes({
                        'error': true,
                        'exception.message': 'Missing payload',
                    });

                    this.logger.error({
                        message:
                            'Message without payload received by the consumer',
                        context: CodeReviewFeedbackConsumer.name,
                        metadata: {
                            message,
                            timestamp: new Date().toISOString(),
                            correlationId,
                        },
                    });

                    throw new Error('Invalid message: no payload');
                }
            },
        );
    }

    private parseTimeoutMs(raw: string | undefined, fallback: number): number {
        const parsed = Number.parseInt(raw ?? '', 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return parsed;
    }

    private async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number,
        label: string,
    ): Promise<T> {
        let timeoutId: NodeJS.Timeout | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Timeout after ${timeoutMs}ms in ${label}`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([promise, timeout]);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
}
