import { migrateRule } from '@libs/core/infrastructure/database/mongo/cody-rules/migrate-origin-request-type';
import {
    CodyRuleRequestType,
    CodyRulesOrigin,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';

describe('migrate-cody-rules backfill — migrateRule', () => {
    it('maps legacy generated origin → past_reviews', () => {
        expect(migrateRule({ origin: 'generated' })?.origin).toBe(
            CodyRulesOrigin.PAST_REVIEWS,
        );
    });

    it('maps legacy user origin → manual', () => {
        expect(migrateRule({ origin: 'user' })?.origin).toBe(
            CodyRulesOrigin.MANUAL,
        );
    });

    it('maps a legacy rule with an IDE sourcePath → repo_file_sync', () => {
        expect(
            migrateRule({ origin: 'user', sourcePath: '.cursorrules' })?.origin,
        ).toBe(CodyRulesOrigin.REPO_FILE_SYNC);
    });

    it('backfills a missing origin → manual', () => {
        expect(migrateRule({ title: 'x' })?.origin).toBe(
            CodyRulesOrigin.MANUAL,
        );
    });

    it('normalizes requestType values', () => {
        expect(migrateRule({ requestType: 'memory_update' })?.requestType).toBe(
            CodyRuleRequestType.UPDATE,
        );
        expect(migrateRule({ requestType: 'memory_create' })?.requestType).toBe(
            CodyRuleRequestType.CREATE,
        );
    });

    it('is idempotent — already-migrated rules are skipped (returns null)', () => {
        expect(
            migrateRule({
                origin: CodyRulesOrigin.PAST_REVIEWS,
                requestType: CodyRuleRequestType.UPDATE,
            }),
        ).toBeNull();
        expect(migrateRule({ origin: CodyRulesOrigin.MANUAL })).toBeNull();
    });

    it('preserves other rule fields', () => {
        const result = migrateRule({
            origin: 'generated',
            title: 'No console.log',
            rule: 'Do not commit console.log',
        });
        expect(result).toMatchObject({
            title: 'No console.log',
            rule: 'Do not commit console.log',
            origin: CodyRulesOrigin.PAST_REVIEWS,
        });
    });
});
