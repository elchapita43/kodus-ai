import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';
import {
    CODY_RULES_SERVICE_TOKEN,
    ICodyRulesService,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import { FindLibraryCodyRulesDto } from '@libs/core/domain/dtos/find-library-cody-rules.dto';
import {
    PaginatedLibraryCodyRulesResponse,
    PaginationMetadata,
} from '@libs/core/domain/dtos/paginated-library-cody-rules.dto';

@Injectable()
export class FindLibraryCodyRulesUseCase {
    private readonly logger = createLogger(FindLibraryCodyRulesUseCase.name);
    constructor(
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
    ) {}

    async execute(
        filters: FindLibraryCodyRulesDto,
    ): Promise<PaginatedLibraryCodyRulesResponse> {
        try {
            const { page = 1, limit = 100, skip, ...codyRuleFilters } = filters;

            // Para rota pública, usa getLibraryCodyRulesWithFeedback mas sem userId
            // Isso traz as contagens gerais mas não o userFeedback
            const allLibraryCodyRules =
                await this.codyRulesService.getLibraryCodyRulesWithFeedback(
                    codyRuleFilters,
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
                message: 'Successfully retrieved library Cody Rules',
                context: FindLibraryCodyRulesUseCase.name,
                metadata: {
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
                message: 'Error finding library Cody Rules',
                context: FindLibraryCodyRulesUseCase.name,
                error: error,
            });
            throw error;
        }
    }
}
