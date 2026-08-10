import type {
    CodyRuleMutationResult,
    CreateCodyRuleRequest,
    CodyRule,
    CodyRuleScope,
    CodyRuleSeverity,
    UpdateCodyRuleRequest,
    ViewCodyRulesRequest,
} from '../types/rules.js';
import { CommandError } from '../utils/command-errors.js';
import { resolveTeamKeyAccess } from '../utils/team-key-auth.js';
import { api } from './api/index.js';

export type UpdateCodyRuleInput = {
    ruleId: string;
} & UpdateCodyRuleRequest;

const VALID_SEVERITIES: CodyRuleSeverity[] = [
    'low',
    'medium',
    'high',
    'critical',
];

const VALID_SCOPES: CodyRuleScope[] = ['pull request', 'file'];

const RULES_AUTH_MESSAGE =
    'Cody Rules commands require team-key auth. Run: codus auth team-key --key <your-key>.\nGet your key from: https://app.kodus.io/organization/cli-keys';

class RulesService {
    async createRule(
        input: CreateCodyRuleRequest,
    ): Promise<CodyRuleMutationResult> {
        const { teamKey } = await resolveTeamKeyAccess(RULES_AUTH_MESSAGE);
        const payload: CreateCodyRuleRequest = {
            title: this.requireText(input.title, 'title'),
            rule: this.requireText(input.rule, 'rule'),
            repositoryId:
                this.normalizeOptionalText(input.repositoryId) || 'global',
            severity: this.normalizeSeverity(input.severity ?? 'medium'),
            scope: this.normalizeScope(input.scope ?? 'file'),
            path: this.normalizeOptionalText(input.path) || '**/*',
        };

        return api.rules.createRule(teamKey, payload);
    }

    async updateRule(
        input: UpdateCodyRuleInput,
    ): Promise<CodyRuleMutationResult> {
        const { teamKey } = await resolveTeamKeyAccess(RULES_AUTH_MESSAGE);
        const ruleId = this.requireText(input.ruleId, 'rule-id');
        let hasRuleChanges = false;

        const payload: UpdateCodyRuleRequest = {};

        const title = this.normalizeOptionalText(input.title);
        if (title) {
            payload.title = title;
            hasRuleChanges = true;
        }

        const rule = this.normalizeOptionalText(input.rule);
        if (rule) {
            payload.rule = rule;
            hasRuleChanges = true;
        }

        if (input.severity !== undefined) {
            payload.severity = this.normalizeSeverity(input.severity);
            hasRuleChanges = true;
        }

        if (input.scope !== undefined) {
            payload.scope = this.normalizeScope(input.scope);
            hasRuleChanges = true;
        }

        const path = this.normalizeOptionalText(input.path);
        if (path) {
            payload.path = path;
            hasRuleChanges = true;
        }

        const repositoryId = this.normalizeOptionalText(input.repositoryId);
        if (repositoryId) {
            payload.repositoryId = repositoryId;
            hasRuleChanges = true;
        }

        if (!hasRuleChanges) {
            throw new CommandError(
                'INVALID_INPUT',
                'Provide at least one field to update: --repo-id, --title, --rule, --severity, --scope, or --path.',
            );
        }

        return api.rules.updateRule(teamKey, ruleId, payload);
    }

    async viewRules(input: ViewCodyRulesRequest = {}): Promise<CodyRule[]> {
        const { teamKey } = await resolveTeamKeyAccess(RULES_AUTH_MESSAGE);
        const query: ViewCodyRulesRequest = {
            repositoryId: this.normalizeOptionalText(input.repositoryId),
            ruleId: this.normalizeOptionalText(input.ruleId),
        };

        return api.rules.viewRules(teamKey, query);
    }

    private normalizeSeverity(value: string): CodyRuleSeverity {
        const normalized = value.trim().toLowerCase() as CodyRuleSeverity;
        if (!VALID_SEVERITIES.includes(normalized)) {
            throw new CommandError(
                'INVALID_INPUT',
                `Invalid severity '${value}'. Use one of: ${VALID_SEVERITIES.join(', ')}.`,
            );
        }

        return normalized;
    }

    private normalizeScope(value: string): CodyRuleScope {
        const normalized = value.trim().toLowerCase() as CodyRuleScope;
        if (!VALID_SCOPES.includes(normalized)) {
            throw new CommandError(
                'INVALID_INPUT',
                `Invalid scope '${value}'. Use one of: ${VALID_SCOPES.join(', ')}.`,
            );
        }

        return normalized;
    }

    private requireText(value: string, field: string): string {
        const normalized = value.trim();
        if (!normalized) {
            throw new CommandError(
                'INVALID_INPUT',
                `--${field} cannot be empty.`,
            );
        }

        return normalized;
    }

    private normalizeOptionalText(value?: string): string | undefined {
        const normalized = value?.trim();
        return normalized ? normalized : undefined;
    }
}

export { RulesService };
export const rulesService = new RulesService();
