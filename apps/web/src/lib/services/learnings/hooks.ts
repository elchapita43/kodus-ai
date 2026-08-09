import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
    createLearning,
    deleteLearning,
    getLearningStats,
    getLearnings,
    supersedeLearning,
    type ListLearningsParams,
} from "./index";

export const LEARNINGS_QUERY_KEY = "learnings";
export const LEARNINGS_STATS_QUERY_KEY = "learnings-stats";

export const useLearnings = (params: ListLearningsParams = {}) => {
    return useQuery({
        queryKey: [LEARNINGS_QUERY_KEY, params],
        queryFn: () => getLearnings(params),
    });
};

export const useLearningStats = (repositoryId?: string) => {
    return useQuery({
        queryKey: [LEARNINGS_STATS_QUERY_KEY, repositoryId],
        queryFn: () => getLearningStats(repositoryId),
    });
};

export const useCreateLearning = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createLearning,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [LEARNINGS_QUERY_KEY] });
            queryClient.invalidateQueries({
                queryKey: [LEARNINGS_STATS_QUERY_KEY],
            });
        },
    });
};

export const useSupersedeLearning = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, newContent }: { id: string; newContent: string }) =>
            supersedeLearning(id, newContent),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [LEARNINGS_QUERY_KEY] });
            queryClient.invalidateQueries({
                queryKey: [LEARNINGS_STATS_QUERY_KEY],
            });
        },
    });
};

export const useDeleteLearning = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteLearning,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [LEARNINGS_QUERY_KEY] });
            queryClient.invalidateQueries({
                queryKey: [LEARNINGS_STATS_QUERY_KEY],
            });
        },
    });
};
