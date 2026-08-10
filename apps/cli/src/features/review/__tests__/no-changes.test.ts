import { describe, expect, it } from 'vitest';
import { buildNoChangesMessages } from '../no-changes.js';

describe('buildNoChangesMessages', () => {
    it('suggests working-tree follow-ups for the default flow', () => {
        expect(
            buildNoChangesMessages([], {
                staged: false,
                branch: undefined,
                commit: undefined,
            }),
        ).toEqual([
            'Try `codus review --staged` to review staged changes only.',
            'Or pass files explicitly, for example: `codus review src/file.ts`.',
        ]);
    });

    it('suggests checking the requested branch scope', () => {
        expect(
            buildNoChangesMessages([], {
                branch: 'main',
            }),
        ).toEqual([
            'No diff was found against `main`.',
            'Confirm the branch name or try a different base branch.',
        ]);
    });

    it('suggests checking the requested files', () => {
        expect(
            buildNoChangesMessages(['src/a.ts', 'src/b.ts'], {}),
        ).toEqual([
            'None of the requested files have diff content in the selected scope.',
            'Check the file paths or try running `codus review` without explicit files.',
        ]);
    });
});
