import { redirect } from "next/navigation";
import {
    getAllOrganizationCodyRules,
    getInheritedCodyRules,
    getCodyRulesByRepositoryId,
} from "@services/codyRules/fetch";
import { resolveCodyRuleById } from "src/core/utils/cody-rules/resolve-rule";
import { addSearchParamsToUrl } from "src/core/utils/url";

import { CodyRuleModalClient } from "./modal-client";

export default async function CodyRuleDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ repositoryId: string; id: string }>;
    searchParams: Promise<{
        directoryId?: string;
        teamId?: string;
        tab?: "review-rules" | "memories" | "configuration";
    }>;
}) {
    try {
        // Await params first (Next.js 15 requirement)
        const { repositoryId, id } = await params;
        const { directoryId, teamId, tab } = await searchParams;

        const rule = await resolveCodyRuleById(
            id,
            { repositoryId, directoryId, teamId },
            {
                byRepo: (repoId, dirId) =>
                    getCodyRulesByRepositoryId(repoId, dirId),
                inherited: (p) => getInheritedCodyRules(p),
                all: () => getAllOrganizationCodyRules(),
            },
        );

        if (!rule) {
            const url = addSearchParamsToUrl(
                `/settings/code-review/${repositoryId}/cody-rules`,
                { directoryId, tab },
            );
            redirect(url);
        }

        return (
            <CodyRuleModalClient
                rule={rule as any}
                repositoryId={repositoryId}
                directoryId={directoryId}
            />
        );
    } catch (error) {
        console.error("Error loading rule:", error);
        redirect("/settings/code-review");
    }
}
