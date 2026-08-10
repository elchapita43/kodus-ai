export type CodyRuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CodyRuleScope = 'pull request' | 'file';

export interface CodyRule {
    uuid: string;
    repositoryId?: string;
    title: string;
    rule: string;
    severity?: CodyRuleSeverity;
    scope?: CodyRuleScope;
    path?: string;
}

export interface CentralizedPrResponse {
    mode: 'centralized-pr';
    prUrl?: string;
    prNumber?: number;
    reused?: boolean;
    pending?: boolean;
    message?: string;
}

export type CodyRuleMutationResult = CodyRule | CentralizedPrResponse;

export const isCentralizedPrResponse = (
    value: unknown,
): value is CentralizedPrResponse => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return (value as { mode?: string }).mode === 'centralized-pr';
};

export interface CreateCodyRuleRequest {
    title: string;
    rule: string;
    repositoryId?: string;
    severity?: CodyRuleSeverity;
    scope?: CodyRuleScope;
    path?: string;
}

export interface UpdateCodyRuleRequest {
    repositoryId?: string;
    title?: string;
    rule?: string;
    severity?: CodyRuleSeverity;
    scope?: CodyRuleScope;
    path?: string;
}

export interface ViewCodyRulesRequest {
    ruleId?: string;
    repositoryId?: string;
}
