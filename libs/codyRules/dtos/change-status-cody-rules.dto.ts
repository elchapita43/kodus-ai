import { CodyRulesStatus } from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeStatusCodyRulesDTO {
    @IsOptional()
    @IsString()
    @ApiProperty({
        type: String,
        required: false,
        example: 'team_123',
    })
    teamId?: string;

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({
        type: String,
        isArray: true,
        example: ['rule_123', 'rule_456'],
    })
    ruleIds: string[];

    @IsEnum(CodyRulesStatus)
    @ApiProperty({
        enum: CodyRulesStatus,
        enumName: 'CodyRulesStatus',
        example: CodyRulesStatus.ACTIVE,
    })
    status: CodyRulesStatus;
}
