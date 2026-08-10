import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';

@Injectable()
export class GetRulesLimitStatusUseCase {
    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    async execute(): Promise<{
        total: number;
    }> {
        const organizationId = this.request.user.organization.uuid;

        if (!organizationId) {
            throw new Error('Organization ID not found');
        }

        return this.codyRulesService.getRulesLimitStatus({
            organizationId,
        });
    }
}
