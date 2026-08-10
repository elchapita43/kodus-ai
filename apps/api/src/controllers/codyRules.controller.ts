import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { AddLibraryCodyRulesUseCase } from '@libs/codyRules/application/use-cases/add-library-cody-rules.use-case';
import { ApplyPendingCodyRulesUseCase } from '@libs/codyRules/application/use-cases/apply-pending-cody-rules.use-case';
import { GetPendingCodyRulesUseCase } from '@libs/codyRules/application/use-cases/get-pending-cody-rules.use-case';
import { ChangeStatusCodyRulesUseCase } from '@libs/codyRules/application/use-cases/change-status-cody-rules.use-case';
import { CheckSyncStatusUseCase } from '@libs/codyRules/application/use-cases/check-sync-status.use-case';
import { ListPastReviewersUseCase } from '@libs/codyRules/application/use-cases/list-past-reviewers.use-case';
import { ConvertPendingUpdatesToNewUseCase } from '@libs/codyRules/application/use-cases/convert-pending-updates-to-new.use-case';
import { CreateOrUpdateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/create-or-update.use-case';
import { DeleteRuleInOrganizationByIdCodyRulesUseCase } from '@libs/codyRules/application/use-cases/delete-rule-in-organization-by-id.use-case';
import { FastSyncIdeRulesUseCase } from '@libs/codyRules/application/use-cases/fast-sync-ide-rules.use-case';
import { FindByOrganizationIdCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-by-organization-id.use-case';
import { FindLibraryCodyRulesBucketsUseCase } from '@libs/codyRules/application/use-cases/find-library-cody-rules-buckets.use-case';
import { FindLibraryCodyRulesWithFeedbackUseCase } from '@libs/codyRules/application/use-cases/find-library-cody-rules-with-feedback.use-case';
import { FindLibraryCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-library-cody-rules.use-case';
import { FindRecommendedCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-recommended-cody-rules.use-case';
import { CountRulesByRepositoryUseCase } from '@libs/codyRules/application/use-cases/count-rules-by-repository.use-case';
import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from '@libs/codyRules/application/use-cases/find-rules-in-organization-by-filter.use-case';
import { FindSuggestionsByRuleUseCase } from '@libs/codyRules/application/use-cases/find-suggestions-by-rule.use-case';
import { GenerateCodyRulesUseCase } from '@libs/codyRules/application/use-cases/generate-cody-rules.use-case';
import { GetInheritedRulesCodyRulesUseCase } from '@libs/codyRules/application/use-cases/get-inherited-cody-rules.use-case';
import { GetRulesLimitStatusUseCase } from '@libs/codyRules/application/use-cases/get-rules-limit-status.use-case';
import { ImportFastCodyRulesUseCase } from '@libs/codyRules/application/use-cases/import-fast-cody-rules.use-case';
import { ManageImportedCodyRulesUseCase } from '@libs/codyRules/application/use-cases/manage-imported-cody-rules.use-case';
import { ResyncRulesFromIdeUseCase } from '@libs/codyRules/application/use-cases/resync-rules-from-ide.use-case';
import { SyncSelectedRepositoriesCodyRulesUseCase } from '@libs/codyRules/application/use-cases/sync-selected-repositories.use-case';
import { GetGlobalRulesSourceRepositoriesUseCase } from '@libs/codyRules/application/use-cases/get-global-rules-source-repositories.use-case';
import { UpdateGlobalRulesSourceRepositoriesUseCase } from '@libs/codyRules/application/use-cases/update-global-rules-source-repositories.use-case';
import { ResyncGlobalRulesUseCase } from '@libs/codyRules/application/use-cases/resync-global-rules.use-case';
import { GetGlobalRulesImportStatusUseCase } from '@libs/codyRules/application/use-cases/get-global-rules-import-status.use-case';
import { GlobalRulesSourceRepository } from '@libs/codyRules/domain/interfaces/global-rules-source.interface';
import { ImportFastCodyRulesDto } from '@libs/codyRules/dtos/import-fast-cody-rules.dto';
import { ReviewFastCodyRulesDto } from '../dtos/review-fast-cody-rules.dto';

import { CacheService } from '@libs/core/cache/cache.service';
import { CreateCodyRuleDto } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { Public } from '@libs/identity/infrastructure/adapters/services/auth/public.decorator';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import {
    checkPermissions,
    checkRepoPermissions,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import {
    ICodyRule,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { AddLibraryCodyRulesDto } from '@libs/codyRules/dtos/add-library-cody-rules.dto';
import { ChangeStatusCodyRulesDTO } from '@libs/codyRules/dtos/change-status-cody-rules.dto';
import { ManageImportedCodyRulesDto } from '@libs/codyRules/dtos/manage-imported-cody-rules.dto';
import { RuleIdsDto } from '@libs/codyRules/dtos/rule-ids.dto';
import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CodyRulesTenantGuard } from '../guards/cody-rules-tenant.guard';
import { REQUEST } from '@nestjs/core';
import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../docs/api-standard-responses.decorator';
import {
    ApiArrayResponseDto,
    ApiBooleanResponseDto,
    ApiObjectResponseDto,
} from '../dtos/api-response.dto';
import { FindLibraryCodyRulesDto } from '../dtos/find-library-cody-rules.dto';
import { FindRecommendedCodyRulesDto } from '../dtos/find-recommended-cody-rules.dto';
import { FindSuggestionsByRuleDto } from '../dtos/find-suggestions-by-rule.dto';
import { GenerateCodyRulesDTO } from '../dtos/generate-cody-rules.dto';
import {
    CodyRuleResponseDto,
    CodyRulesArrayResponseDto,
    CodyRulesPendingResponseDto,
    CodyRulesBucketsResponseDto,
    CodyRulesFastSyncResponseDto,
    CodyRulesFindByOrgResponseDto,
    CodyRulesInheritedResponseDto,
    CodyRulesLibraryResponseDto,
    CodyRulesLimitResponseDto,
    CodyRulesSyncStatusResponseDto,
} from '../dtos/cody-rules-response.dto';

@ApiTags('Cody Rules')
@ApiStandardResponses()
@Controller('cody-rules')
export class CodyRulesController {
    constructor(
        private readonly createOrUpdateCodyRulesUseCase: CreateOrUpdateCodyRulesUseCase,
        private readonly findByOrganizationIdCodyRulesUseCase: FindByOrganizationIdCodyRulesUseCase,
        private readonly findRulesInOrganizationByRuleFilterCodyRulesUseCase: FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
        private readonly deleteRuleInOrganizationByIdCodyRulesUseCase: DeleteRuleInOrganizationByIdCodyRulesUseCase,
        private readonly findLibraryCodyRulesUseCase: FindLibraryCodyRulesUseCase,
        private readonly findLibraryCodyRulesWithFeedbackUseCase: FindLibraryCodyRulesWithFeedbackUseCase,
        private readonly findLibraryCodyRulesBucketsUseCase: FindLibraryCodyRulesBucketsUseCase,
        private readonly findRecommendedCodyRulesUseCase: FindRecommendedCodyRulesUseCase,
        private readonly addLibraryCodyRulesUseCase: AddLibraryCodyRulesUseCase,
        private readonly generateCodyRulesUseCase: GenerateCodyRulesUseCase,
        private readonly applyPendingCodyRulesUseCase: ApplyPendingCodyRulesUseCase,
        private readonly getPendingCodyRulesUseCase: GetPendingCodyRulesUseCase,
        private readonly changeStatusCodyRulesUseCase: ChangeStatusCodyRulesUseCase,
        private readonly checkSyncStatusUseCase: CheckSyncStatusUseCase,
        private readonly listPastReviewersUseCase: ListPastReviewersUseCase,
        private readonly cacheService: CacheService,
        private readonly syncSelectedReposCodyRulesUseCase: SyncSelectedRepositoriesCodyRulesUseCase,
        private readonly getGlobalRulesSourceRepositoriesUseCase: GetGlobalRulesSourceRepositoriesUseCase,
        private readonly updateGlobalRulesSourceRepositoriesUseCase: UpdateGlobalRulesSourceRepositoriesUseCase,
        private readonly resyncGlobalRulesUseCase: ResyncGlobalRulesUseCase,
        private readonly getGlobalRulesImportStatusUseCase: GetGlobalRulesImportStatusUseCase,
        private readonly getInheritedRulesCodyRulesUseCase: GetInheritedRulesCodyRulesUseCase,
        private readonly getRulesLimitStatusUseCase: GetRulesLimitStatusUseCase,
        private readonly findSuggestionsByRuleUseCase: FindSuggestionsByRuleUseCase,
        private readonly resyncRulesFromIdeUseCase: ResyncRulesFromIdeUseCase,
        private readonly fastSyncIdeRulesUseCase: FastSyncIdeRulesUseCase,
        private readonly importFastCodyRulesUseCase: ImportFastCodyRulesUseCase,
        private readonly convertPendingUpdatesToNewUseCase: ConvertPendingUpdatesToNewUseCase,
        private readonly manageImportedCodyRulesUseCase: ManageImportedCodyRulesUseCase,
        private readonly countRulesByRepositoryUseCase: CountRulesByRepositoryUseCase,
        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @ApiBearerAuth('jwt')
    @Post('/create-or-update')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Create or update rule',
        description: 'Create a new rule or update an existing one.',
    })
    @ApiCreatedResponse({ type: CodyRuleResponseDto })
    public async create(
        @Body()
        body: CreateCodyRuleDto,
    ) {
        if (!this.request.user.organization.uuid) {
            throw new Error('Organization ID not found');
        }

        return this.createOrUpdateCodyRulesUseCase.execute(
            body,
            this.request.user.organization.uuid,
            undefined,
            undefined,
            body.teamId,
            this.request.user,
        );
    }

    @ApiBearerAuth('jwt')
    @Get('/find-by-organization-id')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'List rules by organization',
        description: 'Return all rules for the current organization.',
    })
    @ApiOkResponse({ type: CodyRulesFindByOrgResponseDto })
    public async findByOrganizationId() {
        return this.findByOrganizationIdCodyRulesUseCase.execute();
    }

    @ApiBearerAuth('jwt')
    @Get('/limits')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Get rules limit status',
        description: 'Return the current cody rules limit usage.',
    })
    @ApiOkResponse({ type: CodyRulesLimitResponseDto })
    public async getRulesLimitStatus() {
        return this.getRulesLimitStatusUseCase.execute();
    }

    @ApiBearerAuth('jwt')
    @Get('/counts-by-repository')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Count rules per repository/directory',
        description:
            'Returns ACTIVE+PAUSED rule counts grouped by (repositoryId, ' +
            'directoryId) for the org in a single aggregation. Drives the ' +
            'per-repository/directory count badges without fetching each ' +
            "repo's full rules array per card.",
    })
    @ApiOkResponse({ type: ApiArrayResponseDto })
    public async countRulesByRepository() {
        return this.countRulesByRepositoryUseCase.execute();
    }

    @ApiBearerAuth('jwt')
    @Get('/suggestions')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Get suggestions by rule',
        description: 'Return suggestions for a specific rule.',
    })
    @ApiOkResponse({ type: ApiArrayResponseDto })
    public async findSuggestionsByRule(
        @Query() query: FindSuggestionsByRuleDto,
    ) {
        return this.findSuggestionsByRuleUseCase.execute(query.ruleId);
    }

    @ApiBearerAuth('jwt')
    @Get('/find-rules-in-organization-by-filter')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Find rules by filter',
        description: 'Return rules matching a key/value filter.',
    })
    @ApiQuery({ name: 'key', type: String, required: false })
    @ApiQuery({ name: 'value', type: String, required: false })
    @ApiQuery({ name: 'repositoryId', type: String, required: false })
    @ApiQuery({ name: 'directoryId', type: String, required: false })
    @ApiQuery({ name: 'type', enum: CodyRulesType, required: false })
    @ApiOkResponse({ type: ApiArrayResponseDto })
    public async findRulesInOrganizationByFilter(
        @Query('key')
        key?: string,
        @Query('value')
        value?: string,
        @Query('repositoryId')
        repositoryId?: string,
        @Query('directoryId')
        directoryId?: string,
        @Query('type')
        type?: CodyRulesType,
    ) {
        if (!this.request.user.organization.uuid) {
            throw new Error('Organization ID not found');
        }

        const filter: Partial<ICodyRule> = {};
        if (key && value !== undefined) {
            (filter as Record<string, unknown>)[key] = value;
        }
        if (type) {
            filter.type = type;
        }

        return this.findRulesInOrganizationByRuleFilterCodyRulesUseCase.execute(
            this.request.user.organization.uuid,
            filter,
            repositoryId,
            directoryId,
        );
    }

    @ApiBearerAuth('jwt')
    @Delete('/delete-rule-in-organization-by-id')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Delete,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Delete rule by id',
        description: 'Delete a rule in the organization by rule id.',
    })
    @ApiQuery({ name: 'ruleId', type: String, required: true })
    @ApiQuery({ name: 'teamId', type: String, required: false })
    @ApiOkResponse({ type: ApiBooleanResponseDto })
    public async deleteRuleInOrganizationById(
        @Query('ruleId')
        ruleId: string,
        @Query('teamId')
        teamId?: string,
    ) {
        return this.deleteRuleInOrganizationByIdCodyRulesUseCase.execute(
            ruleId,
            {
                source: 'web',
                teamId,
            },
            this.request.user,
        );
    }

    @Get('/find-library-cody-rules')
    @Public()
    @ApiOperation({
        summary: 'List library rules',
        description: 'Return library rules with pagination.',
    })
    @ApiOkResponse({ type: CodyRulesLibraryResponseDto })
    public async findLibraryCodyRules(@Query() query: FindLibraryCodyRulesDto) {
        return this.findLibraryCodyRulesUseCase.execute(query);
    }

    @ApiBearerAuth('jwt')
    @Get('/find-library-cody-rules-with-feedback')
    @ApiOperation({
        summary: 'List library rules with feedback',
        description: 'Return library rules with user feedback and pagination.',
    })
    @ApiOkResponse({ type: CodyRulesLibraryResponseDto })
    public async findLibraryCodyRulesWithFeedback(
        @Query() query: FindLibraryCodyRulesDto,
    ) {
        return this.findLibraryCodyRulesWithFeedbackUseCase.execute(query);
    }

    @Get('/find-library-cody-rules-buckets')
    @Public()
    @ApiOperation({
        summary: 'List library buckets',
        description: 'Return available cody rules buckets.',
    })
    @ApiOkResponse({ type: CodyRulesBucketsResponseDto })
    public async findLibraryCodyRulesBuckets() {
        return this.findLibraryCodyRulesBucketsUseCase.execute();
    }

    @ApiBearerAuth('jwt')
    @Get('/find-recommended-cody-rules')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Find recommended rules',
        description: 'Return recommended rules for the organization.',
    })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    @ApiOkResponse({ type: ApiArrayResponseDto })
    public async findRecommendedCodyRules(
        @Query() query: FindRecommendedCodyRulesDto,
    ) {
        if (!this.request.user.organization.uuid) {
            throw new Error('Organization ID not found');
        }

        const limit = query.limit || 10;
        const cacheKey = `recommended-cody-rules:${this.request.user.organization.uuid}:${limit}`;

        const cachedResult = await this.cacheService.getFromCache(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        const result = await this.findRecommendedCodyRulesUseCase.execute(
            {
                organizationId: this.request.user.organization.uuid,
                teamId: (this.request.user as any).team?.uuid,
            },
            limit,
        );

        await this.cacheService.addToCache(cacheKey, result, 259200000);

        return result;
    }

    @ApiBearerAuth('jwt')
    @Post('/add-library-cody-rules')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Add library rules',
        description: 'Add library rules to the organization repositories.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async addLibraryCodyRules(@Body() body: AddLibraryCodyRulesDto) {
        return this.addLibraryCodyRulesUseCase.execute(body);
    }

    @ApiBearerAuth('jwt')
    @Post('/generate-cody-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Generate rules',
        description: 'Generate rules based on repository history.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async generateCodyRules(@Body() body: GenerateCodyRulesDTO) {
        if (!this.request.user.organization.uuid) {
            throw new Error('Organization ID not found');
        }

        return this.generateCodyRulesUseCase.execute(
            body,
            this.request.user.organization.uuid,
        );
    }

    @ApiBearerAuth('jwt')
    @Post('/change-status-cody-rules')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Change rule status',
        description: 'Update status for one or more rules.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async changeStatusCodyRules(@Body() body: ChangeStatusCodyRulesDTO) {
        return this.changeStatusCodyRulesUseCase.execute(body);
    }

    @ApiBearerAuth('jwt')
    @Post('/pending/apply')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Apply pending rules',
        description: 'Approve one or more pending rules/memories.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async applyPendingCodyRules(@Body() body: RuleIdsDto) {
        return this.applyPendingCodyRulesUseCase.execute(body);
    }

    @ApiBearerAuth('jwt')
    @Post('/pending/discard')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Discard pending rules',
        description: 'Reject one or more pending rules/memories.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async discardPendingCodyRules(@Body() body: RuleIdsDto) {
        return this.changeStatusCodyRulesUseCase.execute({
            ruleIds: body.ruleIds,
            status: CodyRulesStatus.REJECTED,
        });
    }

    @ApiBearerAuth('jwt')
    @Post('/pending/convert-updates-to-new')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Convert pending updates to new rules/memories',
        description:
            'For each pending update request, create a new active rule/memory and discard the original pending request.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async convertPendingUpdatesToNew(@Body() body: RuleIdsDto) {
        return this.convertPendingUpdatesToNewUseCase.execute(body);
    }

    @ApiBearerAuth('jwt')
    @Get('/check-sync-status')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Check sync status',
        description: 'Return sync status flags for IDE and generator.',
    })
    @ApiQuery({ name: 'teamId', type: String, required: true })
    @ApiQuery({ name: 'repositoryId', type: String, required: false })
    @ApiOkResponse({ type: CodyRulesSyncStatusResponseDto })
    public async checkSyncStatus(
        @Query('teamId')
        teamId: string,
        @Query('repositoryId')
        repositoryId?: string,
    ) {
        const cacheKey = `check-sync-status:${this.request.user.organization.uuid}:${teamId}:${repositoryId || 'no-repo'}`;

        // Tenta buscar do cache primeiro
        const cachedResult = await this.cacheService.getFromCache(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        // If not in cache, execute the use case
        const result = await this.checkSyncStatusUseCase.execute(
            teamId,
            repositoryId,
        );

        // Salva no cache por 15 minutos
        await this.cacheService.addToCache(cacheKey, result, 900000); // 15 minutos em milissegundos

        return result;
    }

    @ApiBearerAuth('jwt')
    @Get('/past-reviewers')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'List past reviewers',
        description:
            'Candidate git reviewers (current members ∪ PR authors in the window) a client can exclude from Cody Rules learning.',
    })
    @ApiQuery({ name: 'teamId', type: String, required: true })
    @ApiQuery({ name: 'repositoryId', type: String, required: false })
    @ApiQuery({ name: 'months', type: Number, required: false })
    public async listPastReviewers(
        @Query('teamId') teamId: string,
        @Query('repositoryId') repositoryId?: string,
        @Query('months') months?: string,
    ) {
        // Just parse the query string here; the use-case validates/bounds it.
        return this.listPastReviewersUseCase.execute({
            teamId,
            repositoryId,
            months: months !== undefined ? Number(months) : undefined,
        });
    }

    @ApiBearerAuth('jwt')
    @Post('/sync-ide-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Sync IDE rules',
        description: 'Sync IDE rules for a repository.',
    })
    @ApiNoContentResponse({ description: 'Sync started' })
    public async syncIdeRules(
        @Body() body: { teamId: string; repositoryId: string },
    ) {
        const respositories = [body.repositoryId];

        return this.syncSelectedReposCodyRulesUseCase.execute({
            teamId: body.teamId,
            repositoriesIds: respositories,
        });
    }

    @ApiBearerAuth('jwt')
    @Post('/fast-sync-ide-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Fast sync IDE rules',
        description: 'Fast sync IDE rules with optional limits.',
    })
    @ApiCreatedResponse({ type: CodyRulesFastSyncResponseDto })
    public async fastSyncIdeRules(
        @Body()
        body: {
            teamId: string;
            repositoryId: string;
            maxFiles?: number;
            maxFileSizeBytes?: number;
            maxTotalBytes?: number;
        },
    ) {
        return this.fastSyncIdeRulesUseCase.execute(body);
    }

    @ApiBearerAuth('jwt')
    @Get('/global-source-repositories')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'List global-rules source repositories',
        description:
            'Return the repositories currently selected as sources of global Cody Rules.',
    })
    @ApiQuery({ name: 'teamId', type: String, required: true })
    public async getGlobalSourceRepositories(
        @Query('teamId') teamId: string,
    ) {
        return this.getGlobalRulesSourceRepositoriesUseCase.execute({ teamId });
    }

    @ApiBearerAuth('jwt')
    @Get('/global-source-repositories/import-status')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Global-rules import quota status',
        description:
            'Return the plan tier (free/trial/paid), the import limit, and how many global rules are already imported, so the UI can gate the control.',
    })
    @ApiQuery({ name: 'teamId', type: String, required: true })
    public async getGlobalRulesImportStatus(
        @Query('teamId') teamId: string,
    ) {
        return this.getGlobalRulesImportStatusUseCase.execute({ teamId });
    }

    @ApiBearerAuth('jwt')
    @Post('/global-source-repositories')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Set global-rules source repositories',
        description:
            'Persist the selected source repositories for global Cody Rules; imports added repos and removes rules from deselected ones.',
    })
    public async setGlobalSourceRepositories(
        @Body()
        body: {
            teamId: string;
            repositories: GlobalRulesSourceRepository[];
        },
    ) {
        return this.updateGlobalRulesSourceRepositoriesUseCase.execute({
            teamId: body.teamId,
            repositories: body.repositories ?? [],
        });
    }

    @ApiBearerAuth('jwt')
    @Post('/resync-global-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Resync global rules',
        description:
            'Re-scan every configured source repository into the global scope (covers direct-push changes).',
    })
    public async resyncGlobalRules(@Body() body: { teamId: string }) {
        return this.resyncGlobalRulesUseCase.execute({ teamId: body.teamId });
    }

    @ApiBearerAuth('jwt')
    @Get('/pending')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'List pending rules and memories',
        description:
            'Return every pending Cody Rule and Memory for the org (optionally scoped to a repository), with counts for the Pending badge.',
    })
    @ApiQuery({ name: 'repositoryId', type: String, required: false })
    @ApiOkResponse({ type: CodyRulesPendingResponseDto })
    public async getPending(@Query('repositoryId') repositoryId?: string) {
        return this.getPendingCodyRulesUseCase.execute({ repositoryId });
    }

    @ApiBearerAuth('jwt')
    @Get('/pending-ide-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'List pending IDE rules (deprecated)',
        description:
            'Deprecated: use GET /cody-rules/pending. Returns pending rules for a repository.',
    })
    @ApiQuery({ name: 'teamId', type: String, required: true })
    @ApiQuery({ name: 'repositoryId', type: String, required: false })
    @ApiOkResponse({ type: ApiArrayResponseDto })
    public async listPendingIdeRules(
        @Query('teamId') teamId: string,
        @Query('repositoryId') repositoryId?: string,
    ) {
        const organizationId = this.request.user.organization.uuid;
        return this.findRulesInOrganizationByRuleFilterCodyRulesUseCase.execute(
            organizationId,
            { status: CodyRulesStatus.PENDING },
            repositoryId,
        );
    }

    @ApiBearerAuth('jwt')
    @Post('/import-fast-ide-rules')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Import fast IDE rules',
        description: 'Import rules from fast sync results.',
    })
    @ApiCreatedResponse({ type: CodyRulesArrayResponseDto })
    public async importFastIdeRules(@Body() body: ImportFastCodyRulesDto) {
        return this.importFastCodyRulesUseCase.execute(body);
    }

    @ApiBearerAuth('jwt')
    @Post('/review-fast-ide-rules')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Review fast IDE rules',
        description: 'Activate or delete fast imported rules.',
    })
    @ApiCreatedResponse({ type: ApiObjectResponseDto })
    public async reviewFastIdeRules(@Body() body: ReviewFastCodyRulesDto) {
        const results: any = {};

        if (body.activateRuleIds?.length) {
            results.activated = await this.changeStatusCodyRulesUseCase.execute(
                {
                    ruleIds: body.activateRuleIds,
                    status: CodyRulesStatus.ACTIVE,
                },
            );
        }

        if (body.deleteRuleIds?.length) {
            results.deleted = await this.changeStatusCodyRulesUseCase.execute({
                ruleIds: body.deleteRuleIds,
                status: CodyRulesStatus.DELETED,
            });
        }

        return results;
    }

    @ApiBearerAuth('jwt')
    @Get('/inherited-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkRepoPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
            repo: {
                key: {
                    query: 'repositoryId',
                },
            },
        }),
    )
    @ApiOperation({
        summary: 'Get inherited rules',
        description: 'Return global and repository inherited rules.',
    })
    @ApiOkResponse({ type: CodyRulesInheritedResponseDto })
    public async getInheritedRules(
        @Query('teamId') teamId: string,
        @Query('repositoryId') repositoryId: string,
        @Query('directoryId') directoryId?: string,
    ) {
        if (!this.request.user.organization.uuid) {
            throw new Error('Organization ID not found');
        }

        if (!teamId) {
            throw new Error('Team ID is required');
        }

        if (!repositoryId) {
            throw new Error('Repository ID is required');
        }

        return this.getInheritedRulesCodyRulesUseCase.execute(
            {
                organizationId: this.request.user.organization.uuid,
                teamId,
            },
            repositoryId,
            directoryId,
        );
    }

    // NOT USED IN WEB - INTERNAL USE ONLY
    @ApiBearerAuth('jwt')
    @Post('/resync-ide-rules')
    @UseGuards(PolicyGuard, CodyRulesTenantGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Resync IDE rules',
        description: 'Resync IDE rules (internal).',
    })
    @ApiNoContentResponse({ description: 'Resync started' })
    public async resyncIdeRules(
        @Body() body: { teamId: string; repositoryId: string; path?: string },
    ) {
        const respositories = [body.repositoryId];

        return this.resyncRulesFromIdeUseCase.execute({
            teamId: body.teamId,
            repositoriesIds: respositories,
            path: body.path,
        });
    }

    @ApiBearerAuth('jwt')
    @Post('/imported/manage')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Pause / resume / delete imported (auto-synced) rules',
        description:
            'Acts on the IDE-synced Cody Rules of a repository in bulk. ' +
            'Used by the toggle-off modal in the web UI and by the orphan-rules ' +
            'banner. See ManageImportedRulesAction for action semantics.',
    })
    @ApiOkResponse({ type: ApiObjectResponseDto })
    public async manageImportedRules(@Body() body: ManageImportedCodyRulesDto) {
        const organizationId = this.request.user.organization.uuid;
        if (!organizationId) {
            throw new Error('Organization ID not found');
        }
        const teamId = (this.request.user as any).team?.uuid;

        return this.manageImportedCodyRulesUseCase.execute({
            organizationAndTeamData: { organizationId, teamId },
            repositoryId: body.repositoryId,
            action: body.action,
        });
    }

    @ApiBearerAuth('jwt')
    @Get('/imported/count')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.CodyRules,
        }),
    )
    @ApiOperation({
        summary: 'Count imported (auto-synced) rules per status',
        description:
            'Returns { active, paused, deleted } counts of IDE-synced rules ' +
            'for a repository. Drives copy on the toggle-off confirmation modal ' +
            'and the orphan-rules banner.',
    })
    @ApiQuery({ name: 'repositoryId', type: String, required: true })
    @ApiOkResponse({ type: ApiObjectResponseDto })
    public async countImportedRules(
        @Query('repositoryId') repositoryId: string,
    ) {
        const organizationId = this.request.user.organization.uuid;
        if (!organizationId) {
            throw new Error('Organization ID not found');
        }
        const teamId = (this.request.user as any).team?.uuid;

        return this.manageImportedCodyRulesUseCase.count({
            organizationAndTeamData: { organizationId, teamId },
            repositoryId,
        });
    }
}
