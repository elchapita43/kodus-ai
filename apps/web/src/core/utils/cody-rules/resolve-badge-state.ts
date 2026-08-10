import { CodyRulesStatus } from "@services/codyRules/types";

type RuleBadgeInput = {
    status: CodyRulesStatus;
    lockedByPlan?: boolean;
};

export type CodyRuleBadgeState = "locked" | "paused" | null;

/**
 * Which status badge a Cody Rule item should show. A rule PAUSED because it
 * exceeded the free plan's active-rule quota (`lockedByPlan`) renders as
 * "Locked" with an upgrade CTA; a rule the user paused themselves renders
 * as the plain "Paused" badge. Both share the same underlying PAUSED status,
 * so this is the single place that decides which one the user sees.
 */
export function resolveCodyRuleBadgeState(
    rule: RuleBadgeInput,
): CodyRuleBadgeState {
    if (rule.status !== CodyRulesStatus.PAUSED) return null;
    return rule.lockedByPlan === true ? "locked" : "paused";
}
