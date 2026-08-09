import { authorizedFetch } from "@services/fetch";
import { pathToApiUrl } from "src/core/utils/helpers";

export interface Learning {
    id: string;
    organizationId: string;
    repositoryId: string;
    content: string;
    kind: "convention" | "decision" | "preference" | "noise" | "attempted";
    confidence: "high" | "medium" | "low";
    sourceType: "pr" | "issue" | "review" | "commit" | "manual" | "coderabbit";
    sourceRef: string | null;
    sourceUrl: string | null;
    status: "active" | "superseded";
    supersedesId: string | null;
    createdBy: "system" | "human";
    createdAt: string;
    updatedAt: string;
}

export interface ListLearningsResult {
    items: Learning[];
    total: number;
    page: number;
    limit: number;
}

export interface LearningStats {
    total: number;
    active: number;
    superseded: number;
    byKind: Record<string, number>;
    bySource: Record<string, number>;
}

export interface ListLearningsParams {
    repositoryId?: string;
    status?: string;
    kind?: string;
    sourceType?: string;
    q?: string;
    page?: number;
    limit?: number;
}

export const LEARNINGS_PATHS = {
    LIST: pathToApiUrl("/learnings"),
    STATS: pathToApiUrl("/learnings/stats"),
    DETAIL: (id: string) => pathToApiUrl(`/learnings/${id}`),
    SUPERSEDE: (id: string) => pathToApiUrl(`/learnings/${id}/supersede`),
};

export const getLearnings = async (params: ListLearningsParams = {}) => {
    return authorizedFetch<ListLearningsResult>(LEARNINGS_PATHS.LIST, {
        params: {
            ...params,
            page: params.page ?? 1,
            limit: params.limit ?? 20,
        },
    });
};

export const getLearningStats = async (repositoryId?: string) => {
    return authorizedFetch<LearningStats>(LEARNINGS_PATHS.STATS, {
        params: repositoryId ? { repositoryId } : {},
    });
};

export const getLearning = async (id: string) => {
    return authorizedFetch<Learning>(LEARNINGS_PATHS.DETAIL(id));
};

export const createLearning = async (input: {
    repositoryId: string;
    content: string;
    kind?: string;
    sourceRef?: string | null;
}) => {
    return authorizedFetch<Learning>(LEARNINGS_PATHS.LIST, {
        method: "POST",
        body: JSON.stringify({
            repositoryId: input.repositoryId,
            content: input.content,
            kind: input.kind,
            sourceRef: input.sourceRef,
        }),
        headers: { "Content-Type": "application/json" },
    });
};

export const supersedeLearning = async (id: string, newContent: string) => {
    return authorizedFetch<Learning>(LEARNINGS_PATHS.SUPERSEDE(id), {
        method: "PATCH",
        body: JSON.stringify({ newContent }),
        headers: { "Content-Type": "application/json" },
    });
};

export const deleteLearning = async (id: string) => {
    return authorizedFetch<{ success: boolean }>(LEARNINGS_PATHS.DETAIL(id), {
        method: "DELETE",
    });
};
