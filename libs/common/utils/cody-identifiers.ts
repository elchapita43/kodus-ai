/**
 * Signatures Cody injects at the end (or, on bitbucket, the start) of
 * every comment it posts. Used by:
 *
 *   - Per-provider comment emitters
 *     (`github.service.ts`, `gitlab.service.ts`, `azureRepos.service.ts`,
 *      `forgejo.service.ts`, `bitbucket.service.ts`,
 *      `chatWithCodyFromGit.use-case.ts`, `commentManager.service.ts`)
 *     append the right marker to each Cody comment.
 *
 *   - Read-side filters that need to recognize "this comment was
 *     written by Cody, don't treat it as human signal":
 *     `commentAnalysis.service.ts` (rule-generator input filter),
 *     `validate-prerequisites.stage.ts` (skip re-review on standing
 *     PRs), etc.
 *
 * Two distinct values because bitbucket cloud's Atlassian Markdown
 * escapes raw HTML (it would render `<!-- cody-codereview -->` as
 * visible text), so the HTML-comment marker the other providers
 * suffix to each comment is unusable on bitbucket. Bitbucket gets a
 * visible chip at the start of each comment instead.
 */
export const CODY_IDENTIFIERS = {
    LOGIN_KEYWORDS: ['cody', 'codus'],
    MARKDOWN_IDENTIFIERS: {
        DEFAULT: 'cody-codereview',
        BITBUCKET: 'cody|code-review',
    },
} as const;

/**
 * True when the given comment body looks like one Cody itself
 * authored. Checks BOTH provider signatures so callers don't have to
 * special-case bitbucket. Case-insensitive on the body to match what
 * the existing filter sites have always done.
 */
export function isCodyAuthoredBody(body: string | undefined | null): boolean {
    const lower = (body ?? '').toLowerCase();
    return (
        lower.includes(CODY_IDENTIFIERS.MARKDOWN_IDENTIFIERS.DEFAULT) ||
        lower.includes(CODY_IDENTIFIERS.MARKDOWN_IDENTIFIERS.BITBUCKET)
    );
}
