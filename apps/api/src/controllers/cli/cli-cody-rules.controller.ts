import {
    CreateCodyRuleDto,
    CodyRuleSeverity,
} from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import { Public } from '@libs/identity/infrastructure/adapters/services/auth/public.decorator';
import { CreateOrUpdateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/create-or-update.use-case';
import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-rules-in-organization-by-filter.use-case';
import {
    ICodyRule,
    CodyRulesScope,
    CodyRulesOrigin,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import {
    ITeamCliKeyService,
    TEAM_CLI_KEY_SERVICE_TOKEN,
} from '@libs/organization/domain/team-cli-key/contracts/team-cli-key.service.contract';
import { TEAM_CLI_KEY_CAPABILITIES } from '@libs/organization/domain/team-cli-key/interfaces/team-cli-key.interface';
import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Headers,
    Inject,
    Param,
    Patch,
    Post,
    Query,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiCreatedResponse,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../docs/api-standard-responses.decorator';
import {
    CodyRuleResponseDto,
    CodyRulesArrayResponseDto,
} from '../../dtos/cody-rules-response.dto';

@ApiTags('CLI Cody Rules')
@ApiStandardResponses()
@Public()
@Controller('cli/cody-rules')
export class CliCodyRulesController {
    constructor(
        @Inject(TEAM_CLI_KEY_SERVICE_TOKEN)
        private readonly teamCliKeyService: ITeamCliKeyService,

        private readonly createOrUpdateCodyRuleUseCase: CreateOrUpdateCodyRulesUseCase,
        private readonly findCodyRulesUseCase: FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
    ) {}

    @Get()
    @ApiOperation({
        summary: 'List Cody Rules',
        description:
            'Retrieve a list of Cody Rules for the authenticated team.',
    })
    @ApiHeader({
        name: 'x-team-key',
        required: false,
        description: 'Team CLI key (alternative to Authorization: Bearer)',
    })
    @ApiHeader({
        name: 'authorization',
        required: false,
        description: 'Bearer Team CLI key (alternative to x-team-key)',
    })
    @ApiQuery({
        name: 'ruleId',
        required: false,
        type: String,
        description: 'Filter by Cody Rule UUID',
    })
    @ApiQuery({
        name: 'repositoryId',
        required: false,
        type: String,
        description: 'Filter by Repository ID',
    })
    @ApiOkResponse({ type: CodyRulesArrayResponseDto })
    async listCodyRules(
        @Headers('x-team-key') teamKey?: string,
        @Headers('authorization') authHeader?: string,
        @Query('ruleId') ruleId?: string,
        @Query('repositoryId') repositoryId?: string,
    ) {
        const authContext = await this.resolveCliContext(teamKey, authHeader);
        await this.ensureCodyRulesCapability(authContext);

        const filter: Partial<ICodyRule> = {};
        if (ruleId) filter.uuid = ruleId;
        else if (repositoryId) filter.repositoryId = repositoryId;

        return await this.findCodyRulesUseCase.execute(
            authContext.organizationId,
            filter,
        );
    }

    @Post()
    @ApiOperation({
        summary: 'Create a Cody Rule',
        description: 'Create a new Cody Rule with the provided details.',
    })
    @ApiHeader({
        name: 'x-team-key',
        required: false,
        description: 'Team CLI key (alternative to Authorization: Bearer)',
    })
    @ApiHeader({
        name: 'authorization',
        required: false,
        description: 'Bearer Team CLI key (alternative to x-team-key)',
    })
    @ApiCreatedResponse({ type: CodyRuleResponseDto })
    async createCodyRule(
        @Body() body: Partial<ICodyRule>,
        @Headers('x-team-key') teamKey?: string,
        @Headers('authorization') authHeader?: string,
    ) {
        const authContext = await this.resolveCliContext(teamKey, authHeader);
        await this.ensureCodyRulesCapability(authContext);

        if (body.uuid != undefined) {
            throw new ForbiddenException(
                'UUID should not be provided when creating a new Cody Rule',
            );
        }
        const requiredFieldsBody = this.convertToDTO(body);

        return await this.createOrUpdateCodyRuleUseCase.execute(
            requiredFieldsBody,
            authContext.organizationId,
            undefined,
            undefined,
            authContext.teamId,
        );
    }

    @Patch(':ruleId')
    @ApiOperation({
        summary: 'Update a Cody Rule',
        description: 'Update an existing Cody Rule with the provided details.',
    })
    @ApiHeader({
        name: 'x-team-key',
        required: false,
        description: 'Team CLI key (alternative to Authorization: Bearer)',
    })
    @ApiHeader({
        name: 'authorization',
        required: false,
        description: 'Bearer Team CLI key (alternative to x-team-key)',
    })
    @ApiParam({
        name: 'ruleId',
        required: true,
        type: String,
        description: 'Cody Rule UUID to update',
    })
    @ApiOkResponse({ type: CodyRuleResponseDto })
    async updateCodyRule(
        @Body() body: Partial<ICodyRule>,
        @Param('ruleId') ruleId: string,
        @Headers('x-team-key') teamKey?: string,
        @Headers('authorization') authHeader?: string,
    ) {
        const authContext = await this.resolveCliContext(teamKey, authHeader);
        await this.ensureCodyRulesCapability(authContext);

        if (!ruleId) {
            throw new ForbiddenException('Rule ID is required for update');
        }

        if (body.uuid && body.uuid !== ruleId) {
            throw new ForbiddenException(
                'Body UUID must match the ruleId path parameter',
            );
        }

        const patchPayload = this.convertPatchToDTO(body, ruleId);

        return await this.createOrUpdateCodyRuleUseCase.execute(
            patchPayload,
            authContext.organizationId,
            undefined,
            undefined,
            authContext.teamId,
        );
    }

    private async resolveCliContext(teamKey?: string, authHeader?: string) {
        const bearerToken = authHeader?.replace(/^Bearer\s+/i, '');
        const resolvedTeamKey = teamKey || bearerToken;

        if (!resolvedTeamKey || !resolvedTeamKey.startsWith('codus_')) {
            throw new UnauthorizedException('Team API key required');
        }

        const teamData =
            await this.teamCliKeyService.validateKey(resolvedTeamKey);

        if (!teamData?.team?.uuid || !teamData?.organization?.uuid) {
            throw new UnauthorizedException('Invalid or revoked team API key');
        }

        return {
            organizationId: teamData.organization.uuid,
            teamId: teamData.team.uuid,
            config: teamData.config,
        };
    }

    private ensureCodyRulesCapability(context: {
        organizationId: string;
        teamId: string;
        config?: {
            capabilities?: string[];
        };
    }) {
        const hasCapability =
            context.config?.capabilities?.includes(
                TEAM_CLI_KEY_CAPABILITIES.CODY_RULES_MANAGE,
            ) ?? false;

        if (!hasCapability) {
            throw new ForbiddenException(
                'Team API key does not have permission to manage Cody Rules',
            );
        }
    }

    private convertToDTO(body: Partial<ICodyRule>) {
        const requiredFields = ['title', 'rule', 'repositoryId'];
        const missingFields = requiredFields.filter(
            (field) => body[field as keyof ICodyRule] == undefined,
        );

        if (missingFields.length > 0) {
            throw new ForbiddenException(
                `Missing required fields: ${missingFields.join(', ')}`,
            );
        }

        return {
            title: body.title,
            rule: body.rule,
            status: body.status || CodyRulesStatus.ACTIVE,
            type: body.type || CodyRulesType.STANDARD,
            path: body.path || '*/**',
            origin: body.origin || CodyRulesOrigin.CLI,
            scope: body.scope || CodyRulesScope.FILE,
            severity:
                (body.severity as CodyRuleSeverity) || CodyRuleSeverity.MEDIUM,
            examples: body.examples || [],
            repositoryId: body.repositoryId,
        };
    }

    private convertPatchToDTO(
        body: Partial<ICodyRule>,
        ruleId: string,
    ): CreateCodyRuleDto {
        const fields: Array<keyof ICodyRule> = [
            'title',
            'rule',
            'repositoryId',
            'severity',
            'scope',
            'path',
        ];

        for (const field of fields) {
            if (field in body && body[field] == null) {
                throw new ForbiddenException(
                    `Field '${field}' cannot be set to null or undefined.`,
                );
            }
        }

        return {
            ...body,
            uuid: ruleId,
        } as CreateCodyRuleDto;
    }
}
