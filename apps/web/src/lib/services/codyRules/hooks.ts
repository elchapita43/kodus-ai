import { useMemo } from "react";
import {
    useFetch,
    useSuspenseFetch,
    useSuspenseFetchMany,
} from "src/core/utils/reactQuery";

import {
    resolveRepoCount,
    type CodyRuleRepositoryCount,
} from "src/core/utils/cody-rules/repo-count";

import { CODY_RULES_PATHS } from ".";
import {
    type CodyRule,
    type CodyRulesType,
    type CodyRuleWithInheritanceDetails,
    type LibraryRule,
} from "./types";

export const useSuspenseFindLibraryCodyRules = () => {
    const rules = useSuspenseFetch<Record<string, Array<LibraryRule>>>(
        CODY_RULES_PATHS.FIND_LIBRARY_CODY_RULES,
    );

    return Object.values(rules).flat();
};

export const useSuspenseCodyRulesByRepositoryId = (
    repositoryId: string,
    directoryId?: string,
    type?: CodyRulesType,
) => {
    return useSuspenseFetch<Array<CodyRule>>(
        CODY_RULES_PATHS.FIND_BY_ORGANIZATION_ID_AND_FILTER,
        { params: { repositoryId, directoryId, type } },
    );
};

export const useSuspenseAllOrganizationCodyRules = (type?: CodyRulesType) => {
    return useSuspenseFetch<Array<CodyRule>>(
        CODY_RULES_PATHS.FIND_BY_ORGANIZATION_ID_AND_FILTER,
        type !== undefined ? { params: { type } } : undefined,
    );
};

export const useSuspenseGetPendingIDERules = (params: {
    teamId: string;
    repositoryId?: string;
}) => {
    return useSuspenseFetch<Array<CodyRule>>(
        CODY_RULES_PATHS.PENDING_IDE_RULES,
        { params },
        { fallbackData: [] },
    );
};

export const useSuspenseCodyRulesCheckSyncStatus = (params: {
    teamId: string;
    repositoryId: string;
}) => {
    return useSuspenseFetch<{
        ideRulesSyncEnabledFirstTime: boolean;
        codyRulesGeneratorEnabledFirstTime: boolean;
    }>(CODY_RULES_PATHS.CHECK_SYNC_STATUS, { params });
};

export type GlobalRulesSourceRepository = {
    id: string;
    name: string;
    fullName?: string;
};

export const useSuspenseGlobalRulesSourceRepositories = (params: {
    teamId: string;
}) => {
    return useSuspenseFetch<Array<GlobalRulesSourceRepository>>(
        CODY_RULES_PATHS.GLOBAL_SOURCE_REPOSITORIES,
        { params },
        { fallbackData: [] },
    );
};

export type GlobalRulesImportTier = "free" | "trial" | "paid";

export type GlobalRulesImportStatus = {
    tier: GlobalRulesImportTier;
    limit: number | null;
    used: number;
    remaining: number | null;
};

export const useSuspenseGlobalRulesImportStatus = (params: {
    teamId: string;
}) => {
    return useSuspenseFetch<GlobalRulesImportStatus>(
        CODY_RULES_PATHS.GLOBAL_RULES_IMPORT_STATUS,
        { params },
        {
            fallbackData: {
                tier: "free",
                limit: 0,
                used: 0,
                remaining: 0,
            },
        },
    );
};

export type PastReviewer = { id: string; name: string };

export const useGetPastReviewers = (
    params: { teamId: string; repositoryId?: string; months?: number },
    options?: { enabled?: boolean },
) => {
    return useFetch<PastReviewer[]>(
        CODY_RULES_PATHS.PAST_REVIEWERS,
        { params },
        // 3rd arg is the enabled condition — undefined = enabled (eager).
        options?.enabled,
    );
};

export const useSuspenseGetInheritedCodyRules = (params: {
    teamId: string;
    repositoryId: string;
    directoryId?: string;
}) => {
    return useSuspenseFetch<{
        globalRules: CodyRuleWithInheritanceDetails[];
        repoRules: CodyRuleWithInheritanceDetails[];
        directoryRules: CodyRuleWithInheritanceDetails[];
    }>(CODY_RULES_PATHS.GET_INHERITED_RULES, { params });
};

type InheritedCodyRules = {
    globalRules: CodyRuleWithInheritanceDetails[];
    repoRules: CodyRuleWithInheritanceDetails[];
    directoryRules: CodyRuleWithInheritanceDetails[];
};

/**
 * Loads the two heavy data sets the Cody Rules page needs — the scope's own
 * rules and the inherited rules — IN PARALLEL.
 *
 * Calling `useSuspenseCodyRulesByRepositoryId` and
 * `useSuspenseGetInheritedCodyRules` back-to-back waterfalls: the component
 * suspends on the first, so the inherited request only starts once the scope
 * request resolves. This fires both at once (wall-clock = slowest of the two).
 * The query keys match the single-fetch hooks, so the cache is shared.
 */
export const useSuspenseCodyRulesPageData = (params: {
    teamId: string;
    repositoryId: string;
    directoryId?: string;
}) => {
    const { teamId, repositoryId, directoryId } = params;

    const [scopeRules, inherited] = useSuspenseFetchMany<
        [Array<CodyRule>, InheritedCodyRules]
    >([
        {
            url: CODY_RULES_PATHS.FIND_BY_ORGANIZATION_ID_AND_FILTER,
            params: { params: { repositoryId, directoryId } },
        },
        {
            url: CODY_RULES_PATHS.GET_INHERITED_RULES,
            params: { params: { teamId, repositoryId, directoryId } },
        },
    ]);

    return { scopeRules, inherited };
};

export const useCodyRulesCount = (
    repositoryId: string,
    directoryId?: string,
    enabled = true,
) => {
    // One shared aggregated request for the whole org. The query key carries
    // no per-repo params, so every repository/directory count badge on the
    // settings page de-dupes to a SINGLE request via the React Query cache.
    // Previously each card fetched its repo's full rules array (and ran
    // context-reference enrichment server-side) just to read a length — N
    // heavy requests for N cards. The backend returns ACTIVE+PAUSED counts,
    // matching the pool the user sees in the list.
    const { data } = useFetch<Array<CodyRuleRepositoryCount>>(
        CODY_RULES_PATHS.COUNTS_BY_REPOSITORY,
        undefined,
        enabled,
        { staleTime: 60_000 },
    );

    return useMemo(
        () => resolveRepoCount(data, repositoryId, directoryId),
        [data, repositoryId, directoryId],
    );
};
