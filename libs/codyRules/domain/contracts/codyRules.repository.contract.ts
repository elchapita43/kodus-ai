import { CodyRulesEntity } from '../entities/codyRules.entity';
import {
    ICodyRule,
    ICodyRules,
    CodyRulesStatus,
} from '../interfaces/codyRules.interface';

export const CODY_RULES_REPOSITORY_TOKEN = Symbol.for('CodyRulesRepository');

export interface ICodyRulesRepository {
    getNativeCollection(): any;

    create(
        codyRules: Omit<ICodyRules, 'uuid'>,
    ): Promise<CodyRulesEntity | null>;

    findById(uuid: string): Promise<ICodyRule | null>;
    findOne(filter?: Partial<ICodyRules>): Promise<CodyRulesEntity | null>;
    find(filter?: Partial<ICodyRules>): Promise<CodyRulesEntity[]>;
    /** Projected list of org ids that have ≥1 rule — avoids loading every
     *  org's full embedded rules array (used by the detector sweep). */
    findOrganizationIdsWithRules(): Promise<string[]>;
    findByOrganizationId(
        organizationId: string,
    ): Promise<CodyRulesEntity | null>;

    /**
     * Count rules for an organization matching an optional status.
     * Implemented server-side via aggregation so callers don't need
     * to load the full embedded rules array just to read a number.
     */
    countRules(
        organizationId: string,
        status?: CodyRulesStatus,
    ): Promise<number>;

    /**
     * Counts rules per (repositoryId, directoryId) for an organization in a
     * single aggregation. Replaces fetching every repo's full rules array
     * client-side just to read a `.length` per card. `directoryId` is null
     * for repository-level rules.
     */
    countRulesByRepository(
        organizationId: string,
        statuses: CodyRulesStatus[],
    ): Promise<
        Array<{
            repositoryId: string;
            directoryId: string | null;
            count: number;
        }>
    >;

    update(
        uuid: string,
        updateData: Partial<ICodyRules>,
    ): Promise<CodyRulesEntity | null>;

    delete(uuid: string): Promise<boolean>;

    addRule(
        uuid: string,
        newRule: Partial<ICodyRule>,
    ): Promise<CodyRulesEntity | null>;
    updateRule(
        uuid: string,
        ruleId: string,
        updateData: Partial<ICodyRule>,
    ): Promise<CodyRulesEntity | null>;
    deleteRule(uuid: string, ruleId: string): Promise<boolean>;
    deleteRuleLogically(
        uuid: string,
        ruleId: string,
    ): Promise<CodyRulesEntity | null>;
    updateRulesStatusByFilter(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
        newStatus?: CodyRulesStatus,
    ): Promise<CodyRulesEntity | null>;
}
