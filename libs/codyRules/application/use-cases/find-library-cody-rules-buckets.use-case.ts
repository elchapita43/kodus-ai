import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';

import { BucketInfo } from '@libs/core/infrastructure/config/types/general/codyRules.type';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';

@Injectable()
export class FindLibraryCodyRulesBucketsUseCase {
    private readonly logger = createLogger(
        FindLibraryCodyRulesBucketsUseCase.name,
    );
    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
    ) {}

    async execute(): Promise<BucketInfo[]> {
        try {
            const buckets =
                await this.codyRulesService.getLibraryCodyRulesBuckets();
            return buckets;
        } catch (error) {
            this.logger.error({
                message: 'Error finding library Cody Rules buckets',
                context: FindLibraryCodyRulesBucketsUseCase.name,
                error: error,
            });
            throw error;
        }
    }
}
