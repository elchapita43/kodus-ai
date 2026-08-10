import type { Metadata } from "next";
import {
    getLibraryCodyRulesBuckets,
    getLibraryCodyRulesWithFeedback,
} from "@services/codyRules/fetch";
import { getOrganizationLanguage } from "@services/organizations/fetch";
import { getGlobalSelectedTeamId } from "src/core/utils/get-global-selected-team-id";

import { CodyRulesLibrary } from "../_components/_page";

export const metadata: Metadata = {
    title: "Featured - Cody Rules library",
    openGraph: { title: "Featured - Cody Rules library" },
};

const BUCKETS_PREVIEW_COUNT = 3;
const BUCKET_RULES_PREVIEW_LIMIT = 6;
const FEATURED_TYPE_RULES_LIMIT = 6;

export default async function Route() {
    const teamId = await getGlobalSelectedTeamId();

    const [buckets, orgLanguage, plugAndPlayRules, mcpRules] =
        await Promise.all([
            getLibraryCodyRulesBuckets(),
            getOrganizationLanguage(teamId),
            getLibraryCodyRulesWithFeedback({
                page: 1,
                limit: FEATURED_TYPE_RULES_LIMIT,
                plug_and_play: true,
            }).then((r) => r?.data || []),
            getLibraryCodyRulesWithFeedback({
                page: 1,
                limit: FEATURED_TYPE_RULES_LIMIT
            }).then((r) => r?.data || []),
        ]);
    const previewBuckets = [...buckets]
        .sort((a, b) => b.rulesCount - a.rulesCount)
        .slice(0, BUCKETS_PREVIEW_COUNT);

    const bucketPreviews = await Promise.all(
        previewBuckets.map(async (bucket) => {
            const response = await getLibraryCodyRulesWithFeedback({
                page: 1,
                limit: BUCKET_RULES_PREVIEW_LIMIT,
                buckets: [bucket.slug],
            });

            return { bucket, rules: response?.data || [] };
        }),
    );

    return (
        <CodyRulesLibrary
            buckets={buckets}
            bucketPreviews={bucketPreviews}
            initialView="featured"
            teamLanguage={orgLanguage?.language}
            featuredCollections={[
                {
                    key: "plug-and-play",
                    title: "Plug and play",
                    description:
                        "Ready-to-use rules you can adopt immediately.",
                    viewAllHref:
                        "/library/cody-rules?view=browse&type=plug-and-play",
                    rules: plugAndPlayRules,
                },
                {
                    key: "mcp",
                    title: "MCP rules",
                    description:
                        "Rules curated for teams using MCP integrations.",
                    viewAllHref: "/library/cody-rules?view=browse&type=mcp",
                    rules: mcpRules,
                },
            ]}
            initialRules={[]}
            pagination={{ page: 1, limit: 48, total: 0, totalPages: 1 }}
        />
    );
}
