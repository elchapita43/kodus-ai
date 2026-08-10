import { CodyRulesOrigin } from '@libs/codyRules/domain/interfaces/codyRules.interface';

import { isIdeRuleSource } from './file-patterns';

/** The values `origin` held before it was widened to {@link CodyRulesOrigin}. */
export type LegacyCodyRuleOrigin = 'user' | 'library' | 'generated';

export interface OriginInferenceInput {
    origin?: CodyRulesOrigin | null;
    sourcePath?: string | null;
    legacyOrigin?: LegacyCodyRuleOrigin | null;
}

/**
 * Map a rule onto a {@link CodyRulesOrigin}, used to backfill rows that predate
 * the widened enum. An already-explicit `origin` is returned as-is; otherwise
 * the legacy value and `sourcePath` are mapped. The IDE-file check precedes the
 * `generated` check so a synced file stays `REPO_FILE_SYNC` whatever authored it.
 */
export function resolveCodyRuleOrigin(
    input: OriginInferenceInput,
): CodyRulesOrigin {
    if (input.origin) {
        return input.origin;
    }

    if (input.legacyOrigin === 'library') {
        return CodyRulesOrigin.LIBRARY;
    }

    if (isIdeRuleSource(input.sourcePath)) {
        return CodyRulesOrigin.REPO_FILE_SYNC;
    }

    if (input.legacyOrigin === 'generated') {
        return CodyRulesOrigin.PAST_REVIEWS;
    }

    return CodyRulesOrigin.MANUAL;
}

/** Origins that represent machine-generated knowledge (rules or memories). */
export function isGeneratedCodyRuleOrigin(
    origin?: CodyRulesOrigin | null,
): boolean {
    return (
        origin === CodyRulesOrigin.PAST_REVIEWS ||
        origin === CodyRulesOrigin.ONBOARDING_REPO_ANALYSIS ||
        origin === CodyRulesOrigin.MCP_AGENT
    );
}
