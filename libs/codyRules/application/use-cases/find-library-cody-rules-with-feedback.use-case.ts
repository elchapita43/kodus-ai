import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { FindLibraryCodyRulesDto } from '@libs/core/domain/dtos/find-library-cody-rules.dto';
import {
    PaginatedLibraryCodyRulesResponse,
    PaginationMetadata,
} from '@libs/core/domain/dtos/paginated-library-cody-rules.dto';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';

@Injectable()
export class FindLibraryCodyRulesWithFeedbackUseCase {
    private readonly logger = createLogger(
        FindLibraryCodyRulesWithFeedbackUseCase.name,
    );
    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
        @Inject(REQUEST)
        private readonly request: Request & {
            user?: { uuid: string; organization: { uuid: string } };
        },
    ) {}

    async execute(
        filters: FindLibraryCodyRulesDto,
    ): Promise<PaginatedLibraryCodyRulesResponse> {
        try {
            const { page = 1, limit = 100, skip, ...codyRuleFilters } = filters;

            // Passa userId se o usuário estiver logado
            const userId = this.request.user?.uuid;

            const allLibraryCodyRules =
                await this.codyRulesService.getLibraryCodyRulesWithFeedback(
                    codyRuleFilters,
                    userId,
                );

            // Aplicar paginação
            const totalItems = allLibraryCodyRules.length;
            const totalPages = Math.ceil(totalItems / limit);
            const offset = skip || (page - 1) * limit;
            const paginatedRules = allLibraryCodyRules.slice(
                offset,
                offset + limit,
            );

            const paginationMetadata: PaginationMetadata = {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            };

            this.logger.log({
                message:
                    'Successfully retrieved library Cody Rules with feedback',
                context: FindLibraryCodyRulesWithFeedbackUseCase.name,
                metadata: {
                    userId,
                    totalItems,
                    page,
                    limit,
                    returnedItems: paginatedRules.length,
                },
            });

            return {
                data: paginatedRules,
                pagination: paginationMetadata,
            };
        } catch (error) {
            this.logger.error({
                message: 'Error finding library Cody Rules with feedback',
                context: FindLibraryCodyRulesWithFeedbackUseCase.name,
                error: error,
            });
            throw error;
        }
    }
}
