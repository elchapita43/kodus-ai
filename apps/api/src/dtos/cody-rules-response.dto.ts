import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseBaseDto } from './api-response.dto';

export class CodyRulesLimitDto {
    @ApiProperty()
    total: number;
}

export class CodyRulesLimitResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesLimitDto })
    data: CodyRulesLimitDto;
}

export class CodyRulesSyncStatusDto {
    @ApiProperty()
    ideRulesSyncEnabledFirstTime: boolean;

    @ApiProperty()
    codyRulesGeneratorEnabledFirstTime: boolean;
}

export class CodyRulesSyncStatusResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesSyncStatusDto })
    data: CodyRulesSyncStatusDto;
}

export class CodyRulesBucketDto {
    @ApiProperty()
    slug: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    rulesCount: number;
}

export class CodyRulesBucketsResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesBucketDto, isArray: true })
    data: CodyRulesBucketDto[];
}

export class CodyRulesExampleDto {
    @ApiProperty()
    snippet: string;

    @ApiProperty()
    isCorrect: boolean;
}

export class CodyRulesLibraryRuleDto {
    @ApiProperty()
    title: string;

    @ApiProperty()
    rule: string;

    @ApiProperty()
    why_is_this_important: string;

    @ApiProperty()
    severity: string;

    @ApiProperty()
    bad_example: string;

    @ApiProperty()
    good_example: string;

    @ApiProperty({ type: CodyRulesExampleDto, isArray: true })
    examples: CodyRulesExampleDto[];

    @ApiProperty()
    language: string;

    @ApiProperty({ format: 'uuid' })
    uuid: string;

    @ApiProperty({ type: String, isArray: true })
    buckets: string[];

    @ApiProperty()
    scope: string;

    @ApiProperty()
    plug_and_play: boolean;

    @ApiProperty()
    positiveCount: number;

    @ApiProperty()
    negativeCount: number;

    @ApiProperty({
        nullable: true,
        type: Object,
        description: 'Optional user feedback metadata (provider-specific).',
        additionalProperties: true,
    })
    userFeedback: Record<string, unknown> | null;
}

export class CodyRulesPaginationDto {
    @ApiProperty()
    currentPage: number;

    @ApiProperty()
    totalPages: number;

    @ApiProperty()
    totalItems: number;

    @ApiProperty()
    itemsPerPage: number;

    @ApiProperty()
    hasNextPage: boolean;

    @ApiProperty()
    hasPreviousPage: boolean;
}

export class CodyRulesLibraryDataDto {
    @ApiProperty({ type: CodyRulesLibraryRuleDto, isArray: true })
    data: CodyRulesLibraryRuleDto[];

    @ApiProperty({ type: CodyRulesPaginationDto })
    pagination: CodyRulesPaginationDto;
}

export class CodyRulesLibraryResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesLibraryDataDto })
    data: CodyRulesLibraryDataDto;
}

export class CodyRuleInheritanceDto {
    @ApiProperty()
    inheritable: boolean;

    @ApiProperty({ type: String, isArray: true })
    exclude: string[];

    @ApiProperty({ type: String, isArray: true })
    include: string[];
}

export class CodyRuleExternalReferenceDto {
    @ApiProperty()
    filePath: string;

    @ApiProperty({ nullable: true })
    description?: string;

    @ApiProperty({ nullable: true })
    repositoryName?: string;
}

export class CodyRuleSyncErrorDto {
    @ApiProperty()
    type: string;

    @ApiProperty({ nullable: true })
    message?: string;

    @ApiProperty({
        type: Object,
        description: 'Provider-specific error details.',
        additionalProperties: true,
    })
    details: Record<string, unknown>;
}

export class CodyRuleDto {
    @ApiProperty({ format: 'uuid' })
    uuid: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    rule: string;

    @ApiProperty({ nullable: true })
    path?: string | null;

    @ApiProperty({ nullable: true })
    sourcePath?: string | null;

    @ApiProperty({ nullable: true })
    sourceAnchor?: string | null;

    @ApiProperty()
    severity: string;

    @ApiProperty()
    status: string;

    @ApiProperty({ nullable: true })
    repositoryId?: string | null;

    @ApiProperty({ nullable: true })
    directoryId?: string | null;

    @ApiProperty({ type: CodyRulesExampleDto, isArray: true, nullable: true })
    examples?: CodyRulesExampleDto[] | null;

    @ApiPropertyOptional({
        description:
            'Explicit provenance (manual, library, past_reviews, repo_file_sync, onboarding_repo_analysis, mcp_agent, cli).',
    })
    origin?: string;

    @ApiProperty()
    scope: string;

    @ApiProperty({ type: CodyRuleInheritanceDto })
    inheritance: CodyRuleInheritanceDto;

    @ApiProperty()
    createdAt: string;

    @ApiProperty()
    updatedAt: string;

    @ApiPropertyOptional()
    referenceProcessingStatus?: string | null;

    @ApiProperty({ type: CodyRuleExternalReferenceDto, isArray: true })
    externalReferences: CodyRuleExternalReferenceDto[];

    @ApiProperty({ type: CodyRuleSyncErrorDto, isArray: true })
    syncErrors: CodyRuleSyncErrorDto[];

    @ApiPropertyOptional({
        description:
            'True when the source file currently carries an `@cody-sync` marker — the per-file override that keeps the rule synced even with the repo `ideRulesSyncEnabled=false`. Surfaced so the UI can exclude such rules from the orphan chip and bulk pause/delete actions.',
    })
    pinnedSync?: boolean;

    @ApiPropertyOptional({
        description:
            'True when this rule is PAUSED because activating it would exceed the free plan\'s active-rule quota, rather than a user-initiated pause. The web UI renders these as "Locked" with an upgrade CTA instead of a plain resume toggle.',
    })
    lockedByPlan?: boolean;
}

export class CodyRuleResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRuleDto })
    data: CodyRuleDto;
}

export class CodyRulesArrayResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRuleDto, isArray: true })
    data: CodyRuleDto[];
}

export class CodyRulesPendingCountsDto {
    @ApiProperty()
    total: number;

    @ApiProperty()
    rules: number;

    @ApiProperty()
    memories: number;
}

export class CodyRulesPendingDataDto {
    @ApiProperty({ type: CodyRuleDto, isArray: true })
    items: CodyRuleDto[];

    @ApiProperty({ type: CodyRulesPendingCountsDto })
    counts: CodyRulesPendingCountsDto;
}

export class CodyRulesPendingResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesPendingDataDto })
    data: CodyRulesPendingDataDto;
}

export class CodyRulesFindByOrgDataDto {
    @ApiProperty()
    _uuid: string;

    @ApiProperty()
    _organizationId: string;

    @ApiProperty({ type: CodyRuleDto, isArray: true })
    _rules: CodyRuleDto[];

    @ApiProperty()
    _createdAt: string;

    @ApiProperty()
    _updatedAt: string;
}

export class CodyRulesFindByOrgResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesFindByOrgDataDto })
    data: CodyRulesFindByOrgDataDto;
}

export class CodyRulesFastSyncDataDto {
    @ApiProperty({ type: CodyRuleDto, isArray: true })
    rules: CodyRuleDto[];

    @ApiProperty({ type: String, isArray: true })
    skippedFiles: string[];

    @ApiProperty({
        type: Object,
        isArray: true,
        description: 'Sync errors (provider-specific shape).',
    })
    errors: Record<string, unknown>[];
}

export class CodyRulesFastSyncResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesFastSyncDataDto })
    data: CodyRulesFastSyncDataDto;
}

export class CodyRulesInheritedDataDto {
    @ApiProperty({ type: CodyRuleDto, isArray: true })
    globalRules: CodyRuleDto[];

    @ApiProperty({ type: CodyRuleDto, isArray: true })
    repoRules: CodyRuleDto[];

    @ApiProperty({ type: CodyRuleDto, isArray: true })
    directoryRules: CodyRuleDto[];
}

export class CodyRulesInheritedResponseDto extends ApiResponseBaseDto {
    @ApiProperty({ type: CodyRulesInheritedDataDto })
    data: CodyRulesInheritedDataDto;
}
