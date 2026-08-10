import { CodyRulesStatus } from "@services/codyRules/types";

import { resolveCodyRuleBadgeState } from "./resolve-badge-state";

describe("resolveCodyRuleBadgeState", () => {
    it("returns null for an active rule", () => {
        expect(
            resolveCodyRuleBadgeState({ status: CodyRulesStatus.ACTIVE }),
        ).toBeNull();
    });

    it("returns 'locked' for a rule paused by the plan limit", () => {
        expect(
            resolveCodyRuleBadgeState({
                status: CodyRulesStatus.PAUSED,
                lockedByPlan: true,
            }),
        ).toBe("locked");
    });

    it("returns 'paused' for a rule the user paused themselves", () => {
        expect(
            resolveCodyRuleBadgeState({
                status: CodyRulesStatus.PAUSED,
                lockedByPlan: false,
            }),
        ).toBe("paused");
    });

    it("returns 'paused' when lockedByPlan is absent (legacy/manual pauses)", () => {
        expect(
            resolveCodyRuleBadgeState({ status: CodyRulesStatus.PAUSED }),
        ).toBe("paused");
    });

    it("returns null for other statuses (pending, rejected, deleted)", () => {
        expect(
            resolveCodyRuleBadgeState({
                status: CodyRulesStatus.PENDING,
                lockedByPlan: true,
            }),
        ).toBeNull();
    });
});
