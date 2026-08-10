import {
    ICodyRuleCentralizedConfig,
    ICodyRuleExternalReference,
    ICodyRuleReferenceSyncError,
    CodyRuleCentralizedStatus,
    ICodyRulesExample,
    CodyRuleProcessingStatus,
    CodyRuleRequestType,
    CodyRulesScope,
    CodyRulesOrigin,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export enum CodyRuleSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

export class CodyRulesExampleDto implements ICodyRulesExample {
    @IsString()
    @ApiProperty({ example: 'if (value == null) return;' })
    snippet: string;

    @IsBoolean()
    @ApiProperty({ example: true })
    isCorrect: boolean;
}

export class CodyRulesInheritanceDto {
    @IsBoolean()
    @ApiProperty({ example: true })
    inheritable: boolean;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: String,
        isArray: true,
        example: ['src/legacy/**'],
    })
    exclude: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ApiPropertyOptional({ type: String, isArray: true, example: ['src/**'] })
    include: string[];
}

export class CodyRuleExternalReferenceDto implements ICodyRuleExternalReference {
    @IsString()
    @ApiProperty({ example: 'src/services/user.service.ts' })
    filePath: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        example: 'Reference implementation in user service',
    })
    description?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: 'codus-ai' })
    repositoryName?: string;
}

export class CodyRuleCentralizedConfigDto implements ICodyRuleCentralizedConfig {
    @IsString()
    @ApiProperty({ example: 'repo-a/.cody-rules/review/no-debug.yml' })
    path: string;

    @IsEnum(CodyRuleCentralizedStatus)
    @ApiProperty({
        enum: CodyRuleCentralizedStatus,
        enumName: 'CodyRuleCentralizedStatus',
        example: CodyRuleCentralizedStatus.PENDING_EDIT,
    })
    status: CodyRuleCentralizedStatus;
}

export class CreateCodyRuleDto {
    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        format: 'uuid',
        example: '1e6f6a92-5b4b-4b7d-9c31-4f55f4e9cbd1',
    })
    uuid?: string;

    @IsNotEmpty()
    @IsEnum(CodyRulesType)
    @ApiProperty({
        enum: CodyRulesType,
        enumName: 'CodyRulesType',
        example: CodyRulesType.STANDARD,
    })
    type: CodyRulesType;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ example: 'Avoid null comparisons' })
    title: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        enum: CodyRulesScope,
        enumName: 'CodyRulesScope',
        example: CodyRulesScope.FILE,
    })
    scope?: CodyRulesScope;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({
        example:
            'Avoid comparing to null; prefer strict checks or type guards.',
    })
    rule: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: 'src/services' })
    path: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: 'src/services/user.service.ts' })
    sourcePath?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => CodyRuleCentralizedConfigDto)
    @ApiPropertyOptional({ type: CodyRuleCentralizedConfigDto })
    centralizedConfig?: CodyRuleCentralizedConfigDto;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: 'L10-L24' })
    sourceAnchor?: string;

    @IsNotEmpty()
    @IsEnum(CodyRuleSeverity)
    @ApiProperty({ enum: CodyRuleSeverity, enumName: 'CodyRuleSeverity' })
    severity: CodyRuleSeverity;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        description:
            'Team identifier used to resolve team-scoped centralized configuration for global Cody Rules.',
        example: '2e4f7a61-3c8c-4af5-bf25-2d0cbb19c4d1',
    })
    teamId?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: '1135722979' })
    repositoryId?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        description:
            'For global rules synced from a source repository, the id of that repository. Undefined for every other kind of rule.',
        example: '1135722979',
    })
    sourceRepositoryId?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        description:
            'Git blob SHA of the source file at last sync; used to short-circuit unchanged files on resync.',
    })
    lastContentHash?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: 'src/services' })
    directoryId?: string;

    @IsOptional()
    @IsEnum(CodyRulesOrigin)
    @ApiPropertyOptional({
        enum: CodyRulesOrigin,
        enumName: 'CodyRulesOrigin',
        description: 'Where the rule came from. Defaults to manual when omitted.',
    })
    origin?: CodyRulesOrigin;

    @IsEnum(CodyRulesStatus)
    @IsOptional()
    @ApiPropertyOptional({ enum: CodyRulesStatus, enumName: 'CodyRulesStatus' })
    status?: CodyRulesStatus;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CodyRulesExampleDto)
    @ApiPropertyOptional({ type: CodyRulesExampleDto, isArray: true })
    examples: CodyRulesExampleDto[];

    @IsOptional()
    @ValidateNested()
    @Type(() => CodyRulesInheritanceDto)
    @ApiPropertyOptional({ type: CodyRulesInheritanceDto })
    inheritance?: CodyRulesInheritanceDto;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CodyRuleExternalReferenceDto)
    @ApiPropertyOptional({ type: CodyRuleExternalReferenceDto, isArray: true })
    externalReferences?: CodyRuleExternalReferenceDto[];

    @IsOptional()
    @ApiPropertyOptional({
        type: Object,
        description: 'Reference sync errors returned by external sources.',
        additionalProperties: true,
    })
    syncErrors?: ICodyRuleReferenceSyncError[];

    @IsOptional()
    @IsEnum(CodyRuleProcessingStatus)
    @ApiPropertyOptional({
        enum: CodyRuleProcessingStatus,
        enumName: 'CodyRuleProcessingStatus',
    })
    referenceProcessingStatus?: CodyRuleProcessingStatus;

    @IsOptional()
    lastReferenceProcessedAt?: Date;

    @IsOptional()
    @IsString()
    ruleHash?: string;

    @IsOptional()
    @IsEnum(CodyRuleRequestType)
    @ApiPropertyOptional({
        enum: CodyRuleRequestType,
        enumName: 'CodyRuleRequestType',
    })
    requestType?: CodyRuleRequestType;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        format: 'uuid',
        description:
            'When this rule is a pending request, target rule to update',
    })
    targetRuleUuid?: string;

    @IsOptional()
    @ApiPropertyOptional({
        type: String,
        format: 'date-time',
    })
    @Type(() => Date)
    @IsDate()
    resolvedAt?: Date;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({
        description:
            'User id/email/system identifier that resolved the request',
    })
    resolvedBy?: string;

    @IsOptional()
    @IsBoolean()
    @ApiPropertyOptional({
        description:
            'True when the source file currently carries an `@cody-sync` marker — the per-file override that keeps the rule in sync even with `ideRulesSyncEnabled=false`. Set by the sync service, recomputed on every sync.',
    })
    pinnedSync?: boolean;
}
