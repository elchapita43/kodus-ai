jest.mock('@libs/core/log/logger', () => ({
    createLogger: () => ({
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
    }),
}));

jest.mock('./utils/enrich-rules-with-context-references.util', () => ({
    enrichRulesWithContextReferences: jest.fn(async (rules) => rules),
}));

import { FindByOrganizationIdCodyRulesUseCase } from './find-by-organization-id.use-case';
import { CodyRulesStatus } from '@libs/codyRules/domain/interfaces/codyRules.interface';

/**
 * Regression coverage for the listing leak: the Cody Rules screen kept
 * showing rules even after a "Reset integration and remove repositories
 * config" because this endpoint returned the raw embedded rules array,
 * including soft-deleted entries. The screen now must hide DELETED (and
 * APPLIED, to stay aligned with find-rules-in-organization-by-filter).
 */
describe('FindByOrganizationIdCodyRulesUseCase', () => {
    const ORG_ID = 'org-1';
    let useCase: FindByOrganizationIdCodyRulesUseCase;
    let codyRulesService: { findByOrganizationId: jest.Mock };
    let contextReferenceService: any;
    let request: any;

    beforeEach(() => {
        codyRulesService = { findByOrganizationId: jest.fn() };
        contextReferenceService = {};
        request = { user: { organization: { uuid: ORG_ID } } };

        useCase = new (FindByOrganizationIdCodyRulesUseCase as any)(
            request,
            codyRulesService,
            contextReferenceService,
        );
    });

    it('omits DELETED rules from the response', async () => {
        codyRulesService.findByOrganizationId.mockResolvedValueOnce({
            organizationId: ORG_ID,
            rules: [
                { uuid: 'r-active', status: CodyRulesStatus.ACTIVE },
                { uuid: 'r-deleted', status: CodyRulesStatus.DELETED },
            ],
        });

        const result = (await useCase.execute()) as { rules: any[] };

        expect(result.rules.map((r) => r.uuid)).toEqual(['r-active']);
    });

    it('omits APPLIED rules from the response', async () => {
        codyRulesService.findByOrganizationId.mockResolvedValueOnce({
            organizationId: ORG_ID,
            rules: [
                { uuid: 'r-active', status: CodyRulesStatus.ACTIVE },
                { uuid: 'r-applied', status: CodyRulesStatus.APPLIED },
            ],
        });

        const result = (await useCase.execute()) as { rules: any[] };

        expect(result.rules.map((r) => r.uuid)).toEqual(['r-active']);
    });

    it('keeps PAUSED / PENDING / REJECTED rules visible (only DELETED+APPLIED are hidden)', async () => {
        codyRulesService.findByOrganizationId.mockResolvedValueOnce({
            organizationId: ORG_ID,
            rules: [
                { uuid: 'r-active', status: CodyRulesStatus.ACTIVE },
                { uuid: 'r-paused', status: CodyRulesStatus.PAUSED },
                { uuid: 'r-pending', status: CodyRulesStatus.PENDING },
                { uuid: 'r-rejected', status: CodyRulesStatus.REJECTED },
                { uuid: 'r-deleted', status: CodyRulesStatus.DELETED },
            ],
        });

        const result = (await useCase.execute()) as { rules: any[] };

        expect(result.rules.map((r) => r.uuid)).toEqual([
            'r-active',
            'r-paused',
            'r-pending',
            'r-rejected',
        ]);
    });

    it('handles missing rules array gracefully', async () => {
        codyRulesService.findByOrganizationId.mockResolvedValueOnce({
            organizationId: ORG_ID,
            rules: undefined,
        });

        const result = (await useCase.execute()) as { rules: any[] };

        expect(result.rules).toEqual([]);
    });
});
