import { CodyRulesStatus } from '@libs/codyRules/domain/interfaces/codyRules.interface';

export type CodyRuleAppLinkTab = 'memories' | 'review-rules';

export interface BuildCodyRuleAppLinkParams {
    repositoryId: string | null | undefined;
    ruleId: string | undefined;
    teamId?: string;
    status?: CodyRulesStatus;
    tab: CodyRuleAppLinkTab;
    baseUrl?: string;
}

export function buildCodyRuleAppLink({
    repositoryId,
    ruleId,
    teamId,
    status,
    tab,
    baseUrl,
}: BuildCodyRuleAppLinkParams): string {
    const resolvedBaseUrl = (
        baseUrl ?? process.env.API_USER_INVITE_BASE_URL ?? ''
    ).replace(/\/$/, '');

    if (!resolvedBaseUrl) {
        return '';
    }

    const scope =
        repositoryId && repositoryId !== 'global' ? repositoryId : 'global';

    const url = new URL(resolvedBaseUrl);

    if (status === CodyRulesStatus.PENDING || !ruleId) {
        url.pathname = `/settings/code-review/${scope}/cody-rules`;
        url.searchParams.set('tab', tab);
        return url.toString();
    }

    url.pathname = `/settings/code-review/${scope}/cody-rules/${ruleId}`;
    url.searchParams.set('tab', tab);

    if (teamId) {
        url.searchParams.set('teamId', teamId);
    }

    return url.toString();
}
