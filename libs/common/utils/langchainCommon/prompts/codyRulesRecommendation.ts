import z from 'zod';

export const codyRulesRecommendationSchema = z.object({
    recommendations: z.array(
        z.object({
            uuid: z.string(),
            reason: z.string(),
            relevanceScore: z.number().min(1).max(10),
        }),
    ),
});

export type CodyRulesRecommendation = z.infer<
    typeof codyRulesRecommendationSchema
>;
