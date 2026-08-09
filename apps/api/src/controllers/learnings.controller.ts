import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { CreateLearningUseCase } from '@libs/learnings/application/use-cases/create-learning.use-case';
import { DeleteLearningUseCase } from '@libs/learnings/application/use-cases/delete-learning.use-case';
import { GetLearningUseCase } from '@libs/learnings/application/use-cases/get-learning.use-case';
import { ListLearningStatsUseCase } from '@libs/learnings/application/use-cases/list-learning-stats.use-case';
import { ListLearningsUseCase } from '@libs/learnings/application/use-cases/list-learnings.use-case';
import { SupersedeLearningUseCase } from '@libs/learnings/application/use-cases/supersede-learning.use-case';
import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';

class CreateLearningDto {
    repositoryId: string;
    content: string;
    kind?: string;
    confidence?: string;
    sourceType?: string;
    sourceRef?: string | null;
    sourceUrl?: string | null;
}

class SupersedeLearningDto {
    newContent: string;
}

@ApiTags('Learnings')
@Controller('learnings')
export class LearningsController {
    constructor(
        private readonly createLearningUseCase: CreateLearningUseCase,
        private readonly listLearningsUseCase: ListLearningsUseCase,
        private readonly getLearningUseCase: GetLearningUseCase,
        private readonly listLearningStatsUseCase: ListLearningStatsUseCase,
        private readonly supersedeLearningUseCase: SupersedeLearningUseCase,
        private readonly deleteLearningUseCase: DeleteLearningUseCase,
        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    private orgId(): string {
        const orgId = this.request.user?.organization?.uuid;
        if (!orgId) {
            throw new Error('Organization ID not found');
        }
        return orgId;
    }

    @ApiBearerAuth('jwt')
    @Get()
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.Learnings,
        }),
    )
    @ApiOperation({ summary: 'List learnings with filters' })
    public async list(
        @Query('repositoryId') repositoryId?: string,
        @Query('status') status?: string,
        @Query('kind') kind?: string,
        @Query('sourceType') sourceType?: string,
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.listLearningsUseCase.execute({
            organizationId: this.orgId(),
            repositoryId,
            status: status as any,
            kind: kind as any,
            sourceType: sourceType as any,
            q,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
    }

    @ApiBearerAuth('jwt')
    @Get('stats')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.Learnings,
        }),
    )
    @ApiOperation({ summary: 'Learnings stats for the dashboard' })
    public async stats(@Query('repositoryId') repositoryId?: string) {
        return this.listLearningStatsUseCase.execute({
            organizationId: this.orgId(),
            repositoryId,
        });
    }

    @ApiBearerAuth('jwt')
    @Get(':id')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Read,
            resource: ResourceType.Learnings,
        }),
    )
    @ApiOperation({ summary: 'Get a learning by id' })
    public async getById(@Param('id') id: string) {
        return this.getLearningUseCase.execute(id, this.orgId());
    }

    @ApiBearerAuth('jwt')
    @Post()
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.Learnings,
        }),
    )
    @ApiOperation({ summary: 'Create a manual learning' })
    public async create(@Body() body: CreateLearningDto) {
        return this.createLearningUseCase.execute({
            organizationId: this.orgId(),
            repositoryId: body.repositoryId,
            content: body.content,
            kind: body.kind as any,
            confidence: body.confidence as any,
            sourceType: body.sourceType as any,
            sourceRef: body.sourceRef,
            sourceUrl: body.sourceUrl,
        });
    }

    @ApiBearerAuth('jwt')
    @Patch(':id/supersede')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Update,
            resource: ResourceType.Learnings,
        }),
    )
    @ApiOperation({ summary: 'Refine a learning (supersede old, create new)' })
    public async supersede(
        @Param('id') id: string,
        @Body() body: SupersedeLearningDto,
    ) {
        return this.supersedeLearningUseCase.execute(
            id,
            this.orgId(),
            body.newContent,
        );
    }

    @ApiBearerAuth('jwt')
    @Delete(':id')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Delete,
            resource: ResourceType.Learnings,
        }),
    )
    @ApiOperation({ summary: 'Soft-delete a learning' })
    public async delete(@Param('id') id: string) {
        await this.deleteLearningUseCase.execute(id, this.orgId());
        return { success: true };
    }
}
