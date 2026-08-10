import { Entity } from '@libs/core/domain/interfaces/entity';

import {
    ICodyRule,
    ICodyRules,
    CodyRulesScope,
} from '../interfaces/codyRules.interface';

export class CodyRulesEntity implements Entity<ICodyRules> {
    private readonly _uuid: string;
    private readonly _organizationId: string;
    private readonly _rules: Partial<ICodyRule>[];
    private readonly _createdAt: Date;
    private readonly _updatedAt: Date;

    constructor(codyRules: ICodyRules) {
        this._uuid = codyRules.uuid;
        this._organizationId = codyRules.organizationId;
        this._rules = codyRules.rules;
        this._createdAt = codyRules.createdAt;
        this._updatedAt = codyRules.updatedAt;
    }

    private normalizeRules(rules: Partial<ICodyRule>[]): Partial<ICodyRule>[] {
        return rules.map((rule) => ({
            ...rule,
            scope: rule.scope ?? CodyRulesScope.FILE,
        }));
    }

    toJson(): ICodyRules {
        return {
            uuid: this._uuid,
            organizationId: this._organizationId,
            rules: this.normalizeRules(this._rules),
            createdAt: this._createdAt,
            updatedAt: this._updatedAt,
        };
    }

    toObject(): ICodyRules {
        return {
            uuid: this._uuid,
            organizationId: this._organizationId,
            rules: this.normalizeRules(this._rules),
            createdAt: this._createdAt,
            updatedAt: this._updatedAt,
        };
    }

    public static create(codyRules: ICodyRules): CodyRulesEntity {
        return new CodyRulesEntity(codyRules);
    }

    get uuid(): string {
        return this._uuid;
    }

    get organizationId(): string {
        return this._organizationId;
    }

    get rules(): Partial<ICodyRule>[] {
        return this.normalizeRules([...this._rules]);
    }

    get createdAt(): Date {
        return this._createdAt;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }
}
