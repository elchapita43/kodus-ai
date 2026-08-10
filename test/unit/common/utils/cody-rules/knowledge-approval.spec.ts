import { requiresKnowledgeApproval } from '@libs/common/utils/cody-rules/knowledge-approval';
import { CodyRulesOrigin } from '@libs/codyRules/domain/interfaces/codyRules.interface';

describe('requiresKnowledgeApproval', () => {
    it('never requires approval when disabled (or unset)', () => {
        for (const origin of Object.values(CodyRulesOrigin)) {
            expect(requiresKnowledgeApproval(undefined, origin)).toBe(false);
            expect(
                requiresKnowledgeApproval({ enabled: false }, origin),
            ).toBe(false);
        }
    });

    describe('when enabled, with no per-origin overrides', () => {
        const config = { enabled: true };

        it.each([
            CodyRulesOrigin.PAST_REVIEWS,
            CodyRulesOrigin.ONBOARDING_REPO_ANALYSIS,
            CodyRulesOrigin.MCP_AGENT,
        ])('requires approval for generated origin %s', (origin) => {
            expect(requiresKnowledgeApproval(config, origin)).toBe(true);
        });

        it('requires approval for repo_file_sync (auto-synced IDE rule files)', () => {
            expect(
                requiresKnowledgeApproval(
                    config,
                    CodyRulesOrigin.REPO_FILE_SYNC,
                ),
            ).toBe(true);
        });

        it.each([
            CodyRulesOrigin.MANUAL,
            CodyRulesOrigin.LIBRARY,
            CodyRulesOrigin.CLI,
        ])(
            'does not require approval for user/imported origin %s',
            (origin) => {
                expect(requiresKnowledgeApproval(config, origin)).toBe(false);
            },
        );
    });
});
