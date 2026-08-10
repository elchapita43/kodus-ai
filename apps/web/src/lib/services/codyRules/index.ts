import { pathToApiUrl } from "src/core/utils/helpers";

export const CODY_RULES_PATHS = {
    CREATE_OR_UPDATE: pathToApiUrl("/cody-rules/create-or-update"),
    FIND_BY_ORGANIZATION_ID: pathToApiUrl(
        "/cody-rules/find-by-organization-id",
    ),
    FIND_BY_ORGANIZATION_ID_AND_FILTER: pathToApiUrl(
        "/cody-rules/find-rules-in-organization-by-filter",
    ),
    DELETE_BY_ORGANIZATION_ID_AND_ROLE_UUID: pathToApiUrl(
        "/cody-rules/delete-rule-in-organization-by-id",
    ),
    FIND_LIBRARY_CODY_RULES: pathToApiUrl(
        "/cody-rules/find-library-cody-rules",
    ),
    FIND_LIBRARY_CODY_RULES_WITH_FEEDBACK: pathToApiUrl(
        "/cody-rules/find-library-cody-rules-with-feedback",
    ),
    FIND_LIBRARY_CODY_RULES_BUCKETS: pathToApiUrl(
        "/cody-rules/find-library-cody-rules-buckets",
    ),
    ADD_LIBRARY_CODY_RULES: pathToApiUrl("/cody-rules/add-library-cody-rules"),
    FAST_SYNC_IDE_RULES: pathToApiUrl("/cody-rules/fast-sync-ide-rules"),
    PENDING_IDE_RULES: pathToApiUrl("/cody-rules/pending-ide-rules"),
    REVIEW_FAST_IDE_RULES: pathToApiUrl("/cody-rules/review-fast-ide-rules"),
    CHANGE_STATUS_CODY_RULES: pathToApiUrl(
        "/cody-rules/change-status-cody-rules",
    ),
    APPLY_PENDING_CODY_RULES: pathToApiUrl("/cody-rules/pending/apply"),
    DISCARD_PENDING_CODY_RULES: pathToApiUrl("/cody-rules/pending/discard"),
    CONVERT_PENDING_UPDATES_TO_NEW: pathToApiUrl(
        "/cody-rules/pending/convert-updates-to-new",
    ),
    GENERATE_CODY_RULES: pathToApiUrl("/cody-rules/generate-cody-rules"),
    SYNC_IDE_RULES: pathToApiUrl("/cody-rules/sync-ide-rules"),
    CHECK_SYNC_STATUS: pathToApiUrl("/cody-rules/check-sync-status"),
    PAST_REVIEWERS: pathToApiUrl("/cody-rules/past-reviewers"),
    GET_INHERITED_RULES: pathToApiUrl("/cody-rules/inherited-rules"),
    GET_CODY_RULES_TOTAL_QUANTITY: pathToApiUrl("/cody-rules/limits"),
    GET_CODY_RULE_SUGGESTIONS: pathToApiUrl("/cody-rules/suggestions"),
    FIND_RECOMMENDED_CODY_RULES: pathToApiUrl(
        "/cody-rules/find-recommended-cody-rules",
    ),
    MANAGE_IMPORTED_CODY_RULES: pathToApiUrl("/cody-rules/imported/manage"),
    COUNT_IMPORTED_CODY_RULES: pathToApiUrl("/cody-rules/imported/count"),
    COUNTS_BY_REPOSITORY: pathToApiUrl("/cody-rules/counts-by-repository"),
    GLOBAL_SOURCE_REPOSITORIES: pathToApiUrl(
        "/cody-rules/global-source-repositories",
    ),
    GLOBAL_RULES_IMPORT_STATUS: pathToApiUrl(
        "/cody-rules/global-source-repositories/import-status",
    ),
    RESYNC_GLOBAL_RULES: pathToApiUrl("/cody-rules/resync-global-rules"),
} as const;
