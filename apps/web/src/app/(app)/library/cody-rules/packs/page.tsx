import type { Metadata } from "next";
import {
    getLibraryCodyRulesBuckets,
    getLibraryCodyRulesWithFeedback,
} from "@services/codyRules/fetch";

import { CodyRulesPacksExplorer } from "./_components/_page";

export const metadata: Metadata = {
    title: "Rules Packs - Cody Rules library",
    openGraph: { title: "Rules Packs - Cody Rules library" },
};

export default async function Route() {
    const [rulesResponse, buckets] = await Promise.all([
        getLibraryCodyRulesWithFeedback({ page: 1, limit: 1000 }), // Get all rules to get sample rules
        getLibraryCodyRulesBuckets(),
    ]);

    // Get sample rules for each bucket (rulesCount already comes from API)
    const bucketsWithStats = buckets.map((bucket) => {
        const rulesInBucket =
            rulesResponse?.data?.filter((rule) =>
                rule.buckets?.includes(bucket.slug),
            ) || [];

        return {
            ...bucket,
            sampleRules: rulesInBucket.slice(0, 2), // Get first 2 rules as samples
        };
    });

    return <CodyRulesPacksExplorer buckets={bucketsWithStats} />;
}
