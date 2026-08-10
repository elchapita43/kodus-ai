import { Inject, Injectable, Optional } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import {
    ICodyRule,
    CodyRulesStatus,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from './find-rules-in-organization-by-filter.use-case';

export interface PendingCodyRulesResult {
    items: Partial<ICodyRule>[];
    counts: { total: number; rules: number; memories: number };
}

/**
 * The single source for the Pending area: every pending Cody Rule and Memory
 * for the org (optionally scoped to a repository), plus counts for the badge.
 * Items carry `type`/`origin`/`requestType`/`targetRuleUuid` so the UI can show
 * provenance and tell create-requests from update-requests.
 */
@Injectable()
export class GetPendingCodyRulesUseCase implements IUseCase {
    constructor(
        @Optional()
        @Inject(REQUEST)
        private readonly request: UserRequest,
        private readonly findRulesUseCase: FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
    ) {}

    async execute(
        params: { repositoryId?: string } = {},
    ): Promise<PendingCodyRulesResult> {
        const organizationId = this.request?.user?.organization?.uuid;
        if (!organizationId) {
            throw new Error('Organization ID not found');
        }

        const items = await this.findRulesUseCase.execute(
            organizationId,
            { status: CodyRulesStatus.PENDING },
            params.repositoryId,
        );

        const memories = items.filter(
            (rule) => rule.type === CodyRulesType.MEMORY,
        ).length;

        return {
            items,
            counts: {
                total: items.length,
                rules: items.length - memories,
                memories,
            },
        };
    }
}
