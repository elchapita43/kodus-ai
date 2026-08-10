import { CodyRulesStatus } from '@libs/codyRules/domain/interfaces/codyRules.interface';

import { buildCodyRuleAppLink } from './build-rule-link';

describe('buildCodyRuleAppLink', () => {
    const baseUrl = 'https://app.kodus.io';

    it('returns empty string when baseUrl is missing', () => {
        expect(
            buildCodyRuleAppLink({
                repositoryId: 'repo-1',
                ruleId: 'rule-1',
                tab: 'review-rules',
                baseUrl: '',
            }),
        ).toBe('');
    });

    it('falls back to API_USER_INVITE_BASE_URL when baseUrl is omitted', () => {
        const previous = process.env.API_USER_INVITE_BASE_URL;
        process.env.API_USER_INVITE_BASE_URL = baseUrl;
        try {
            const link = buildCodyRuleAppLink({
                repositoryId: 'repo-1',
                ruleId: 'rule-1',
                tab: 'review-rules',
                status: CodyRulesStatus.ACTIVE,
            });
            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/repo-1/cody-rules/rule-1?tab=review-rules',
            );
        } finally {
            process.env.API_USER_INVITE_BASE_URL = previous;
        }
    });

    it('normalizes a trailing slash on baseUrl', () => {
        const link = buildCodyRuleAppLink({
            repositoryId: 'repo-1',
            ruleId: 'rule-1',
            status: CodyRulesStatus.ACTIVE,
            tab: 'review-rules',
            baseUrl: 'https://app.kodus.io/',
        });

        expect(link).toBe(
            'https://app.kodus.io/settings/code-review/repo-1/cody-rules/rule-1?tab=review-rules',
        );
    });

    describe('when the rule is PENDING', () => {
        it('returns the standard-rules list URL with tab=review-rules', () => {
            const link = buildCodyRuleAppLink({
                repositoryId: 'repo-1',
                ruleId: 'rule-1',
                status: CodyRulesStatus.PENDING,
                tab: 'review-rules',
                baseUrl,
            });

            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/repo-1/cody-rules?tab=review-rules',
            );
        });

        it('returns the memories list URL with tab=memories', () => {
            const link = buildCodyRuleAppLink({
                repositoryId: 'repo-1',
                ruleId: 'rule-1',
                status: CodyRulesStatus.PENDING,
                tab: 'memories',
                baseUrl,
            });

            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/repo-1/cody-rules?tab=memories',
            );
        });

        it('uses the global scope when repositoryId is null', () => {
            const link = buildCodyRuleAppLink({
                repositoryId: null,
                ruleId: undefined,
                status: CodyRulesStatus.PENDING,
                tab: 'review-rules',
                baseUrl,
            });

            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/global/cody-rules?tab=review-rules',
            );
        });

        it('uses the global scope when repositoryId is the literal "global"', () => {
            const link = buildCodyRuleAppLink({
                repositoryId: 'global',
                ruleId: 'rule-1',
                status: CodyRulesStatus.PENDING,
                tab: 'memories',
                baseUrl,
            });

            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/global/cody-rules?tab=memories',
            );
        });
    });

    describe('when the rule is not PENDING and has a ruleId', () => {
        it('returns the edit URL with the ruleId in the path', () => {
            const link = buildCodyRuleAppLink({
                repositoryId: 'repo-1',
                ruleId: 'rule-1',
                status: CodyRulesStatus.ACTIVE,
                tab: 'review-rules',
                baseUrl,
            });

            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/repo-1/cody-rules/rule-1?tab=review-rules',
            );
        });

        it('appends teamId to the edit URL when provided', () => {
            const link = buildCodyRuleAppLink({
                repositoryId: 'repo-1',
                ruleId: 'rule-1',
                teamId: 'team-99',
                status: CodyRulesStatus.ACTIVE,
                tab: 'memories',
                baseUrl,
            });

            expect(link).toBe(
                'https://app.kodus.io/settings/code-review/repo-1/cody-rules/rule-1?tab=memories&teamId=team-99',
            );
        });
    });

    it('treats a missing ruleId as the PENDING case (returns the list URL)', () => {
        const link = buildCodyRuleAppLink({
            repositoryId: 'repo-1',
            ruleId: undefined,
            status: CodyRulesStatus.ACTIVE,
            tab: 'review-rules',
            baseUrl,
        });

        expect(link).toBe(
            'https://app.kodus.io/settings/code-review/repo-1/cody-rules?tab=review-rules',
        );
    });
});
