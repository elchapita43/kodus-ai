import { CodyRulesOrigin } from '@libs/codyRules/domain/interfaces/codyRules.interface';

import { isGeneratedCodyRuleOrigin } from './resolve-origin';

export type CodyKnowledgeApprovalConfig = {
    enabled: boolean;
};

/**
 * Whether a rule/memory of the given origin needs approval before it becomes
 * active, under the resolved (global/repo/directory-merged) config. When
 * enabled, generated knowledge AND auto-synced IDE rule files
 * (`repo_file_sync`) require approval; manual/library/CLI origins remain
 * active. `repo_file_sync` is gated but deliberately kept out of
 * `isGeneratedCodyRuleOrigin` — it's imported, not machine-generated, and that
 * helper drives origin display / centralized-sync classification elsewhere.
 */
export function requiresKnowledgeApproval(
    config: CodyKnowledgeApprovalConfig | undefined,
    origin: CodyRulesOrigin,
): boolean {
    if (!config?.enabled) {
        return false;
    }

    return (
        isGeneratedCodyRuleOrigin(origin) ||
        origin === CodyRulesOrigin.REPO_FILE_SYNC
    );
}
