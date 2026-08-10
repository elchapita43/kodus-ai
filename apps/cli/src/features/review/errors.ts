import type { NormalizedCommandError } from '../../utils/command-errors.js';

export function buildReviewErrorHints(
    error: NormalizedCommandError,
): string[] {
    switch (error.code) {
        case 'AUTH_REQUIRED':
            return [
                'Run `codus auth login` to use your account or `codus auth team-key --key <your-key>` to use a team key.',
            ];
        case 'API_REQUEST_FAILED':
            if (error.message.includes('Could not reach the Codus API')) {
                return [
                    'Check `CODUS_API_URL` and make sure the Codus API is running if you are testing locally.',
                ];
            }
            return [];
        case 'NOT_IN_GIT_REPO':
            return [
                'Run `codus review` inside a Git repository, or pass explicit file paths to review.',
            ];
        case 'INVALID_INPUT':
            return [
                'Run `codus review --help` to see supported options, examples, and valid flag combinations.',
            ];
        default:
            return [];
    }
}
