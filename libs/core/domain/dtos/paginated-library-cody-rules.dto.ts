import { LibraryCodyRule } from '@libs/core/infrastructure/config/types/general/codyRules.type';

export class PaginationMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

export class PaginatedLibraryCodyRulesResponse {
    data: LibraryCodyRule[];
    pagination: PaginationMetadata;
}
