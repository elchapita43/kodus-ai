import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CodyRulesScope } from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { CodyRuleSeverity } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ImportFastCodyRuleExampleDto {
    @ApiProperty({ example: 'if (value == null) return;' })
    snippet: string;

    @ApiProperty({ example: true })
    isCorrect: boolean;
}

class ImportFastCodyRuleItemDto {
    @ApiProperty({ example: 'Avoid null comparisons' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({
        example:
            'Avoid comparing to null; prefer strict checks or type guards.',
    })
    @IsString()
    @IsNotEmpty()
    rule: string;

    @ApiProperty({ example: 'src/services/user.service.ts' })
    @IsString()
    @IsNotEmpty()
    path: string;

    @ApiProperty({ example: 'src/services/user.service.ts' })
    @IsString()
    @IsNotEmpty()
    sourcePath: string;

    @ApiProperty({ example: '1135722979' })
    @IsString()
    @IsNotEmpty()
    repositoryId: string;

    @IsOptional()
    @IsEnum(CodyRuleSeverity)
    @ApiPropertyOptional({
        enum: CodyRuleSeverity,
        enumName: 'CodyRuleSeverity',
    })
    severity?: CodyRuleSeverity;

    @IsOptional()
    @IsEnum(CodyRulesScope)
    @ApiPropertyOptional({ enum: CodyRulesScope, enumName: 'CodyRulesScope' })
    scope?: CodyRulesScope;

    @ApiPropertyOptional({
        type: ImportFastCodyRuleExampleDto,
        isArray: true,
        description: 'Example snippets for the rule.',
    })
    @IsOptional()
    examples?: ImportFastCodyRuleExampleDto[];
}

export class ImportFastCodyRulesDto {
    @ApiProperty({
        format: 'uuid',
        example: 'c33ef663-70e7-4f43-9605-0bbef979b8e0',
    })
    @IsString()
    @IsNotEmpty()
    teamId: string;

    @ApiProperty({ type: ImportFastCodyRuleItemDto, isArray: true })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImportFastCodyRuleItemDto)
    rules: ImportFastCodyRuleItemDto[];
}
