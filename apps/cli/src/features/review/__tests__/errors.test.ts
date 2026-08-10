import { describe, expect, it } from 'vitest';
import { buildReviewErrorHints } from '../errors.js';
import type { NormalizedCommandError } from '../../../utils/command-errors.js';

function createError(
    overrides: Partial<NormalizedCommandError>,
): NormalizedCommandError {
    return {
        code: 'INTERNAL_ERROR',
        message: 'boom',
        exitCode: 1,
        ...overrides,
    };
}

describe('buildReviewErrorHints', () => {
    it('suggests auth commands for auth failures', () => {
        expect(
            buildReviewErrorHints(
                createError({
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication failed.',
                }),
            ),
        ).toEqual([
            'Run `codus auth login` to use your account or `codus auth team-key --key <your-key>` to use a team key.',
        ]);
    });

    it('suggests checking API URL for connectivity errors', () => {
        expect(
            buildReviewErrorHints(
                createError({
                    code: 'API_REQUEST_FAILED',
                    message:
                        'Could not reach the Codus API at http://localhost:3001.',
                }),
            ),
        ).toEqual([
            'Check `CODUS_API_URL` and make sure the Codus API is running if you are testing locally.',
        ]);
    });

    it('suggests running inside a git repo for git context failures', () => {
        expect(
            buildReviewErrorHints(
                createError({
                    code: 'NOT_IN_GIT_REPO',
                    message: 'Not a git repository',
                }),
            ),
        ).toEqual([
            'Run `codus review` inside a Git repository, or pass explicit file paths to review.',
        ]);
    });

    it('suggests help output for invalid input', () => {
        expect(
            buildReviewErrorHints(
                createError({
                    code: 'INVALID_INPUT',
                    message: 'Invalid --fail-on value',
                }),
            ),
        ).toEqual([
            'Run `codus review --help` to see supported options, examples, and valid flag combinations.',
        ]);
    });

    it('returns no hints for unrelated failures', () => {
        expect(buildReviewErrorHints(createError({}))).toEqual([]);
    });
});
