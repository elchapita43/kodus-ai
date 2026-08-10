import type { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import type { ICodyRule } from '@libs/codyRules/domain/interfaces/codyRules.interface';

/**
 * Build a deep link to a Cody Rule's settings page.
 *
 * The web route is `/settings/code-review/<repoId>/cody-rules/<ruleId>`,
 * but for directory-scoped rules the UI also needs `directoryId` and
 * `teamId` in the query string — without them the page renders a 404
 * (the rule lives under a directory scope the page can't resolve from
 * the path segment alone). Reported by quintoandar (David B): every
 * link Cody pasted into a PR comment for a directory-scoped rule was
 * dead.
 *
 * Three callsites used to inline this URL build (one per pipeline:
 * file-level review, PR-level review, agent review) and all three
 * suffered from the same omission. Centralising here keeps them in
 * sync.
 */
export function buildCodyRuleLink(
    baseUrl: string,
    ruleId: string,
    rule: Partial<Pick<ICodyRule, 'repositoryId' | 'directoryId'>>,
    organizationAndTeamData?: Pick<OrganizationAndTeamData, 'teamId'>,
): string {
    // Some callers come from a `Map<id, Partial<ICodyRule>>` that the
    // pipeline builds out of LLM-truncated rule records, so any of
    // these fields can be missing. Default to "global" if there's no
    // repositoryId — that's the safest landing for a fallback link.
    const repoSegment =
        !rule.repositoryId || rule.repositoryId === 'global'
            ? 'global'
            : rule.repositoryId;
    const path = `${baseUrl}/settings/code-review/${repoSegment}/cody-rules/${ruleId}`;

    const params = new URLSearchParams();
    if (rule.directoryId) {
        params.set('directoryId', rule.directoryId);
    }
    if (organizationAndTeamData?.teamId) {
        params.set('teamId', organizationAndTeamData.teamId);
    }

    const query = params.toString();
    return query ? `${path}?${query}` : path;
}
