import { authorizedFetch } from '@services/fetch';
import type { CentralizedPrResponse } from '@services/parameters/types';
import { ProgrammingLanguage } from 'src/core/enums/programming-language';
import { axiosAuthorized } from 'src/core/utils/axios';

import { CODY_RULES_PATHS } from '.';
import type {
    CodyRule,
    CodyRuleBucket,
    CodyRulesStatus,
    CodyRulesType,
    CodyRuleSuggestion,
    LibraryRule,
    PaginatedResponse,
} from './types';

export type FastSyncIDERulesPayload = {
    teamId: string;
    repositoryId: string;
    maxFiles?: number;
    maxFileSizeBytes?: number;
    maxTotalBytes?: number;
};

export type FastSyncIDERulesResponse = {
    rules: CodyRule[];
    skippedFiles?: unknown[];
    errors?: unknown[];
};

export type ReviewFastIDERulesPayload = {
    teamId: string;
    activateRuleIds?: string[];
    deleteRuleIds?: string[];
};

export type ReviewFastIDERulesResponse = {
    activatedRules?: CodyRule[];
    deletedRules?: CodyRule[];
    errors?: unknown[];
};

export type CodyRuleMutationResponse = CodyRule | CentralizedPrResponse;

export const createOrUpdateCodyRule = async (
    rule: CodyRule,
    repositoryId?: string,
    directoryId?: string,
    teamId?: string,
): Promise<CodyRuleMutationResponse> => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.CREATE_OR_UPDATE,
        { ...rule, repositoryId, directoryId, teamId },
    );

    if (response && typeof response === 'object' && 'data' in response) {
        return (response as { data?: CodyRuleMutationResponse })
            .data as CodyRuleMutationResponse;
    }

    return response as CodyRuleMutationResponse;
};

export const addCodyRuleToRepositories = async (props: {
    repositoriesIds: string[];
    directoriesIds: Array<{ directoryId: string; repositoryId: string }>;
    rule: CodyRule;
    teamId?: string;
}): Promise<CodyRule[] | CentralizedPrResponse> => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.ADD_LIBRARY_CODY_RULES,
        {
            ...props.rule,
            repositoriesIds: props.repositoriesIds,
            directoriesInfo: props.directoriesIds,
            teamId: props.teamId,
        },
    );

    return response.data as CodyRule[] | CentralizedPrResponse;
};

export const deleteCodyRule = async (
    ruleId: string,
    teamId?: string,
): Promise<boolean | CentralizedPrResponse> => {
    const response = await axiosAuthorized.deleted<any>(
        CODY_RULES_PATHS.DELETE_BY_ORGANIZATION_ID_AND_ROLE_UUID,
        { params: { ruleId, teamId } },
    );

    if (response && typeof response === 'object' && 'data' in response) {
        return (response as { data?: boolean | CentralizedPrResponse }).data as
            | boolean
            | CentralizedPrResponse;
    }

    return response as boolean | CentralizedPrResponse;
};

export const getLibraryCodyRulesWithFeedback = async (params?: {
    page?: number;
    limit?: number;
    buckets?: string[];
    name?: string;
    severity?: string;
    tags?: string[];
    language?: keyof typeof ProgrammingLanguage;
    plug_and_play?: boolean;
}) => {
    // Build params object for authorizedFetch
    const fetchParams: Record<string, string | number | boolean | undefined> = {
        page: params?.page || 1,
        limit: params?.limit || 50,
    };

    // Add other filters if provided
    if (params?.name) fetchParams.title = params.name; // Backend expects 'title' not 'name'
    if (params?.severity) fetchParams.severity = params.severity;
    if (params?.language) fetchParams.language = String(params.language);
    if (params?.plug_and_play) fetchParams.plug_and_play = true;

    // For arrays, we need to handle them as multiple parameters with the same key
    // But since authorizedFetch doesn't handle array params well, we'll build the URL manually
    const queryParams = new URLSearchParams();

    Object.entries(fetchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
        }
    });

    // Add bucket filters as multiple parameters
    if (params?.buckets && params.buckets.length > 0) {
        params.buckets.forEach((bucket) => {
            queryParams.append('buckets', bucket);
        });
    }

    // Add tag filters as multiple parameters
    if (params?.tags && params.tags.length > 0) {
        params.tags.forEach((tag) => {
            queryParams.append('tags', tag);
        });
    }

    const url = `${CODY_RULES_PATHS.FIND_LIBRARY_CODY_RULES_WITH_FEEDBACK}?${queryParams.toString()}`;

    const response = await authorizedFetch<PaginatedResponse<LibraryRule>>(url);
    return response;
};

export const getLibraryCodyRulesBuckets = async () => {
    const response = await authorizedFetch<Array<CodyRuleBucket>>(
        CODY_RULES_PATHS.FIND_LIBRARY_CODY_RULES_BUCKETS,
    );
    return response || [];
};

export const fastSyncIDERules = async (
    payload: FastSyncIDERulesPayload,
): Promise<FastSyncIDERulesResponse> => {
    const response = await axiosAuthorized.post<FastSyncIDERulesResponse>(
        CODY_RULES_PATHS.FAST_SYNC_IDE_RULES,
        payload,
    );

    return response;
};

export const getCodyRulesByRepositoryId = async (
    repositoryId: string,
    directoryId?: string,
    type?: CodyRulesType,
    tags?: string[],
) => {
    const rules = await authorizedFetch<Array<CodyRule>>(
        CODY_RULES_PATHS.FIND_BY_ORGANIZATION_ID_AND_FILTER,
        {
            params: { repositoryId, directoryId, type },
            next: { tags },
        },
    );

    return rules;
};

export const getAllOrganizationCodyRules = async (type?: CodyRulesType) => {
    const rules = await authorizedFetch<Array<CodyRule>>(
        CODY_RULES_PATHS.FIND_BY_ORGANIZATION_ID_AND_FILTER,
        { params: { type } },
    );
    return rules;
};

export const getPendingIDERules = async (params: {
    teamId: string;
    repositoryId?: string;
}) => {
    const rules = await authorizedFetch<Array<CodyRule>>(
        CODY_RULES_PATHS.PENDING_IDE_RULES,
        { params },
    );

    return rules;
};

export const getInheritedCodyRules = async (params: {
    teamId: string;
    repositoryId: string;
    directoryId?: string;
}) => {
    const rules = await authorizedFetch<{
        globalRules: CodyRule[];
        repoRules: CodyRule[];
        directoryRules: CodyRule[];
    }>(CODY_RULES_PATHS.GET_INHERITED_RULES, { params });
    return rules;
};

export const changeStatusCodyRules = async (
    ruleIds: string[],
    status: CodyRulesStatus,
) => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.CHANGE_STATUS_CODY_RULES,
        { ruleIds, status },
    );

    return response.data as CodyRule[] | CentralizedPrResponse;
};

export const applyPendingCodyRules = async (
    teamId: string,
    ruleIds: string[],
) => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.APPLY_PENDING_CODY_RULES,
        { teamId, ruleIds },
    );

    return response.data as CodyRule[] | CentralizedPrResponse;
};

export const discardPendingCodyRules = async (
    teamId: string,
    ruleIds: string[],
) => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.DISCARD_PENDING_CODY_RULES,
        { teamId, ruleIds },
    );

    return response.data as CodyRule[];
};

export const convertPendingUpdatesToNew = async (
    teamId: string,
    ruleIds: string[],
) => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.CONVERT_PENDING_UPDATES_TO_NEW,
        { teamId, ruleIds },
    );

    return response.data as CodyRule[] | CentralizedPrResponse;
};

export const generateCodyRules = async (
    teamId: string,
    months: number = 3,
    weeks?: number,
    days?: number,
) => {
    const response = await axiosAuthorized.post<any>(
        CODY_RULES_PATHS.GENERATE_CODY_RULES,
        {
            teamId,
            months,
            weeks,
            days,
        },
    );

    return response.data;
};

export const syncIDERules = (params: {
    teamId: string;
    repositoryId: string;
}) => {
    axiosAuthorized.post(CODY_RULES_PATHS.SYNC_IDE_RULES, params);
};

export type GlobalRulesSourceRepository = {
    id: string;
    name: string;
    fullName?: string;
};

export const getGlobalSourceRepositories = async (params: {
    teamId: string;
}): Promise<GlobalRulesSourceRepository[]> => {
    const url = `${CODY_RULES_PATHS.GLOBAL_SOURCE_REPOSITORIES}?teamId=${encodeURIComponent(params.teamId)}`;
    const result = await authorizedFetch<GlobalRulesSourceRepository[]>(url);
    return result ?? [];
};

export const setGlobalSourceRepositories = async (params: {
    teamId: string;
    repositories: GlobalRulesSourceRepository[];
}): Promise<GlobalRulesSourceRepository[]> => {
    const response =
        await axiosAuthorized.post<GlobalRulesSourceRepository[]>(
            CODY_RULES_PATHS.GLOBAL_SOURCE_REPOSITORIES,
            params,
        );
    return response;
};

export const resyncGlobalRules = async (params: {
    teamId: string;
}): Promise<{ repositories: number }> => {
    const response = await axiosAuthorized.post<{ repositories: number }>(
        CODY_RULES_PATHS.RESYNC_GLOBAL_RULES,
        params,
    );
    return response;
};

export const reviewFastIDERules = async (
    payload: ReviewFastIDERulesPayload,
): Promise<ReviewFastIDERulesResponse> => {
    const response = await axiosAuthorized.post<ReviewFastIDERulesResponse>(
        CODY_RULES_PATHS.REVIEW_FAST_IDE_RULES,
        payload,
    );

    return response;
};

export const getCodyRuleSuggestions = async (ruleId: string) => {
    const url = `${CODY_RULES_PATHS.GET_CODY_RULE_SUGGESTIONS}?ruleId=${ruleId}`;
    const suggestions = await authorizedFetch<CodyRuleSuggestion[]>(url);
    return suggestions || [];
};

export const getRecommendedCodyRules = async (params?: { limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) {
        queryParams.append('limit', params.limit.toString());
    }

    const url = queryParams.toString()
        ? `${CODY_RULES_PATHS.FIND_RECOMMENDED_CODY_RULES}?${queryParams.toString()}`
        : CODY_RULES_PATHS.FIND_RECOMMENDED_CODY_RULES;

    const rules = await authorizedFetch<LibraryRule[]>(url);
    return rules || [];
};

/** Auto-synced ("imported") rules counted per status for a repository. Used by
 * the IDE auto-sync toggle-off modal and the orphan-rules banner.
 *
 * `pinned` counts ACTIVE+PAUSED rules whose source file carries `@cody-sync`.
 * The bulk pause/delete actions skip those, so the modal copy uses this to
 * tell the user "M pinned rules will be preserved" before they pick an
 * action and get a surprising result. */
export type ImportedCodyRulesCounts = {
    active: number;
    paused: number;
    deleted: number;
    pinned: number;
};

export const getImportedCodyRulesCount = async (params: {
    repositoryId: string;
}): Promise<ImportedCodyRulesCounts> => {
    const url = `${CODY_RULES_PATHS.COUNT_IMPORTED_CODY_RULES}?repositoryId=${encodeURIComponent(params.repositoryId)}`;
    const result = await authorizedFetch<ImportedCodyRulesCounts>(url);
    return result ?? { active: 0, paused: 0, deleted: 0, pinned: 0 };
};

export type ManageImportedCodyRulesAction = 'pause' | 'resume' | 'delete';

export const manageImportedCodyRules = async (params: {
    repositoryId: string;
    action: ManageImportedCodyRulesAction;
}): Promise<{
    action: ManageImportedCodyRulesAction;
    counts: ImportedCodyRulesCounts;
}> => {
    const response = await axiosAuthorized.post<{
        action: ManageImportedCodyRulesAction;
        counts: ImportedCodyRulesCounts;
    }>(CODY_RULES_PATHS.MANAGE_IMPORTED_CODY_RULES, params);
    return response;
};

export type PastReviewer = { id: string; name: string };

// Candidate git reviewers a client can exclude from Cody Rules learning
// (issue #1497): current members ∪ authors of PRs in the window.
export const getPastReviewers = async (params: {
    teamId: string;
    repositoryId?: string;
    months?: number;
}): Promise<PastReviewer[]> => {
    const result = await authorizedFetch<PastReviewer[]>(
        CODY_RULES_PATHS.PAST_REVIEWERS,
        { params },
    );
    return result ?? [];
};
