import { LearningsDeriverConsumer } from './learnings-deriver.consumer';

describe('LearningsDeriverConsumer', () => {
    const derive = { execute: jest.fn() };
    const consumer = new LearningsDeriverConsumer(derive as any);
    const amqpMsg = {
        properties: { headers: { 'x-correlation-id': 'corr-1' } },
    } as any;

    beforeEach(() => jest.clearAllMocks());

    it('ignores stages that are not CODE_REVIEW', async () => {
        await consumer.onStageCompleted(
            { eventType: 'AST_GRAPH_BUILD', result: {} },
            amqpMsg,
        );
        expect(derive.execute).not.toHaveBeenCalled();
    });

    it('skips when result has no derivable payload', async () => {
        await consumer.onStageCompleted(
            { eventType: 'CODE_REVIEW', result: { foo: 'bar' } },
            amqpMsg,
        );
        expect(derive.execute).not.toHaveBeenCalled();
    });

    it('derives learnings from a code review result', async () => {
        derive.execute.mockResolvedValue([]);

        await consumer.onStageCompleted(
            {
                eventType: 'CODE_REVIEW',
                result: {
                    repositoryId: 'repo-1',
                    organizationId: 'org-1',
                    pullRequestNumber: 1140,
                    title: 'fix onboarding',
                    reviewSummary: 'Buen cambio, falta test',
                    suggestions: [
                        { label: 'CRITICAL', content: 'No exponer el token' },
                    ],
                },
            },
            amqpMsg,
        );

        expect(derive.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                repositoryId: 'repo-1',
                organizationId: 'org-1',
                sourceRef: '#1140',
                sourceType: 'review',
            }),
        );
        const arg = derive.execute.mock.calls[0][0];
        expect(arg.messages.join(' ')).toContain('fix onboarding');
        expect(arg.messages.join(' ')).toContain('No exponer el token');
    });

    it('never throws: swallows deriver errors (pipeline protection)', async () => {
        derive.execute.mockRejectedValue(new Error('LLM timeout'));

        await expect(
            consumer.onStageCompleted(
                {
                    eventType: 'CODE_REVIEW',
                    result: {
                        repositoryId: 'repo-1',
                        organizationId: 'org-1',
                        pullRequestNumber: 1141,
                        title: 'x',
                    },
                },
                amqpMsg,
            ),
        ).resolves.toBeUndefined();
    });
});
