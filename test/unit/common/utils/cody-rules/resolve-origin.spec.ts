import {
    isGeneratedCodyRuleOrigin,
    resolveCodyRuleOrigin,
} from '@libs/common/utils/cody-rules/resolve-origin';
import { CodyRulesOrigin } from '@libs/codyRules/domain/interfaces/codyRules.interface';

describe('resolveCodyRuleOrigin', () => {
    it('returns an explicit origin verbatim, ignoring legacyOrigin/sourcePath', () => {
        expect(
            resolveCodyRuleOrigin({
                origin: CodyRulesOrigin.MCP_AGENT,
                legacyOrigin: 'library',
                sourcePath: '.cursorrules',
            }),
        ).toBe(CodyRulesOrigin.MCP_AGENT);
    });

    it('infers LIBRARY from legacy origin', () => {
        expect(resolveCodyRuleOrigin({ legacyOrigin: 'library' })).toBe(
            CodyRulesOrigin.LIBRARY,
        );
    });

    it('infers REPO_FILE_SYNC from an IDE rule-file sourcePath (runtime, no legacyOrigin)', () => {
        expect(
            resolveCodyRuleOrigin({ sourcePath: '.cursor/rules/style.mdc' }),
        ).toBe(CodyRulesOrigin.REPO_FILE_SYNC);
    });

    it('prefers REPO_FILE_SYNC over GENERATED when both signals are present', () => {
        expect(
            resolveCodyRuleOrigin({
                legacyOrigin: 'generated',
                sourcePath: 'apps/web/.cursorrules',
            }),
        ).toBe(CodyRulesOrigin.REPO_FILE_SYNC);
    });

    it('infers PAST_REVIEWS from legacy generated origin without an IDE sourcePath', () => {
        expect(resolveCodyRuleOrigin({ legacyOrigin: 'generated' })).toBe(
            CodyRulesOrigin.PAST_REVIEWS,
        );
    });

    it('defaults to MANUAL for a legacy user rule', () => {
        expect(resolveCodyRuleOrigin({ legacyOrigin: 'user' })).toBe(
            CodyRulesOrigin.MANUAL,
        );
    });

    it('defaults to MANUAL when nothing is known (runtime fallback)', () => {
        expect(resolveCodyRuleOrigin({})).toBe(CodyRulesOrigin.MANUAL);
    });

    it('treats a non-IDE sourcePath as not REPO_FILE_SYNC', () => {
        expect(
            resolveCodyRuleOrigin({
                sourcePath: 'src/services/user.service.ts',
            }),
        ).toBe(CodyRulesOrigin.MANUAL);
    });
});

describe('isGeneratedCodyRuleOrigin', () => {
    it.each([
        CodyRulesOrigin.PAST_REVIEWS,
        CodyRulesOrigin.ONBOARDING_REPO_ANALYSIS,
        CodyRulesOrigin.MCP_AGENT,
    ])('treats %s as generated', (origin) => {
        expect(isGeneratedCodyRuleOrigin(origin)).toBe(true);
    });

    it.each([
        CodyRulesOrigin.MANUAL,
        CodyRulesOrigin.LIBRARY,
        CodyRulesOrigin.REPO_FILE_SYNC,
        undefined,
    ])('treats %s as not generated', (origin) => {
        expect(isGeneratedCodyRuleOrigin(origin)).toBe(false);
    });
});
