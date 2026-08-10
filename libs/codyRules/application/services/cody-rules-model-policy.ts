import { BYOKConfig } from '@codus/codus-common/llm';

import { environment } from '@libs/ee/configs/environment';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { PermissionValidationService } from '@libs/ee/shared/services/permissionValidation.service';

/**
 * The Codus-funded model for Cody Rules generation when there's no BYOK:
 * DeepSeek V4 Flash via the DeepSeek official API (`API_DEEPSEEK_API_KEY`),
 * routed by `byokToVercelModel`'s `deepseek-*` prefix detection. Gemini is dead
 * (project denied access) and must never be used here — see item 9 of
 * docs/plans/fix-cody-rules-generation.md.
 */
export const CODY_RULES_CODUS_MODEL = 'deepseek-v4-flash';

/**
 * Resolved model policy for a Cody Rules generation run.
 *
 * `generate: false` means the run must be skipped (no model the org is
 * entitled to). `byokConfig`/`modelOverride` feed `byokToVercelModel`:
 * BYOK wins when present; otherwise `modelOverride` forces the Codus model
 * (DeepSeek); self-hosted resolves the env model (both undefined).
 */
export interface CodyRulesModelPolicy {
    generate: boolean;
    byokConfig?: BYOKConfig;
    modelOverride?: string;
    /** Set when `generate` is false — human-readable reason for the skip. */
    skipReason?: string;
}

/**
 * Decides which model (if any) a Cody Rules generation run may use.
 *
 * Policy (see docs/plans/fix-cody-rules-generation.md). The Codus-funded model
 * is ALWAYS DeepSeek — Gemini is dead and must never be reached from this flow:
 * - BYOK configured              → client's BYOK model.
 * - Self-hosted (not cloud)      → the deployment's env model (customer keys).
 * - Cloud + dev OR trial         → DeepSeek V4 Flash (Codus pays).
 * - Cloud + free/paid, no BYOK   → SKIP (generates nothing).
 */
export async function resolveCodyRulesModelPolicy(
    permissionValidationService: PermissionValidationService,
    organizationAndTeamData: OrganizationAndTeamData,
): Promise<CodyRulesModelPolicy> {
    const byokConfig = await permissionValidationService.getBYOKConfig(
        organizationAndTeamData,
    );
    if (byokConfig) {
        return { generate: true, byokConfig };
    }

    // Self-hosted deployments bring their own model via env (customer keys),
    // not a Codus-funded model. byokToVercelModel(undefined) resolves it.
    if (!environment.API_CLOUD_MODE) {
        return { generate: true };
    }

    // Cloud. When Codus foots the bill (local dev, or an active trial) the model
    // is DeepSeek — explicitly overridden so byokToVercelModel never falls back
    // to its dead Gemini default.
    const subscriptionStatus =
        await permissionValidationService.getSubscriptionStatus(
            organizationAndTeamData,
        );

    if (environment.API_DEVELOPMENT_MODE || subscriptionStatus === 'trial') {
        return { generate: true, modelOverride: CODY_RULES_CODUS_MODEL };
    }

    return {
        generate: false,
        skipReason: subscriptionStatus
            ? `no BYOK configured on '${subscriptionStatus}' plan — Cody Rules generation requires BYOK outside the trial`
            : 'no BYOK configured and no active trial — Cody Rules generation skipped',
    };
}
