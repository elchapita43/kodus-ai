import fs from 'fs/promises';
import path from 'path';

const CODY_CHECKPOINT_MARKER = '# codus-session-hooks';
const CODY_CHECKPOINT_END_MARKER = '# /codus-session-hooks';

const PREPARE_COMMIT_MSG_SCRIPT = `
${CODY_CHECKPOINT_MARKER}
# Add Cody-Checkpoint trailer to commit messages
CODY_SESSION_DIR="$(git rev-parse --git-common-dir 2>/dev/null)/cody-sessions"
if [ -d "$CODY_SESSION_DIR" ]; then
  ACTIVE_SESSION=$(ls -t "$CODY_SESSION_DIR"/*.json 2>/dev/null | head -1)
  if [ -n "$ACTIVE_SESSION" ]; then
    SESSION_ID=$(basename "$ACTIVE_SESSION" .json)
    SHORT_ID=$(echo "$SESSION_ID" | cut -c1-12)
    if ! grep -q "Cody-Checkpoint:" "$1" 2>/dev/null; then
      echo "" >> "$1"
      echo "Cody-Checkpoint: $SHORT_ID" >> "$1"
    fi
  fi
fi
${CODY_CHECKPOINT_END_MARKER}
`.trimStart();

const POST_COMMIT_SCRIPT = `
${CODY_CHECKPOINT_MARKER}
# Notify codus of git commit for checkpoint condensation
codus sessions hooks claude-code stop 2>/dev/null &
${CODY_CHECKPOINT_END_MARKER}
`.trimStart();

class GitHooksService {
    /**
     * Install prepare-commit-msg and post-commit hooks for checkpoint tracking.
     *
     * `hooksDir` must be the directory git actually executes hooks from —
     * resolve it with `gitService.getHooksDir()` rather than joining
     * `.git/hooks` onto the worktree root, which breaks inside linked
     * worktrees (where `.git` is a file) and ignores `core.hooksPath`.
     */
    async install(
        hooksDir: string,
    ): Promise<{ installed: string[]; alreadyInstalled: string[] }> {
        const installed: string[] = [];
        const alreadyInstalled: string[] = [];

        const prepareResult = await this.installHook(
            hooksDir,
            'prepare-commit-msg',
            PREPARE_COMMIT_MSG_SCRIPT,
        );
        if (prepareResult.alreadyInstalled) {
            alreadyInstalled.push('prepare-commit-msg');
        } else {
            installed.push('prepare-commit-msg');
        }

        const postResult = await this.installHook(
            hooksDir,
            'post-commit',
            POST_COMMIT_SCRIPT,
        );
        if (postResult.alreadyInstalled) {
            alreadyInstalled.push('post-commit');
        } else {
            installed.push('post-commit');
        }

        return { installed, alreadyInstalled };
    }

    /**
     * Remove codus session hooks from prepare-commit-msg and post-commit.
     */
    async uninstall(hooksDir: string): Promise<{ removed: string[] }> {
        const removed: string[] = [];

        const prepareResult = await this.removeHook(
            hooksDir,
            'prepare-commit-msg',
        );
        if (prepareResult) {
            removed.push('prepare-commit-msg');
        }

        const postResult = await this.removeHook(hooksDir, 'post-commit');
        if (postResult) {
            removed.push('post-commit');
        }

        return { removed };
    }

    private async installHook(
        hooksDir: string,
        hookName: string,
        script: string,
    ): Promise<{ hookPath: string; alreadyInstalled: boolean }> {
        const hookPath = path.join(hooksDir, hookName);

        let existing = '';
        try {
            existing = await fs.readFile(hookPath, 'utf-8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }

        if (existing.includes(CODY_CHECKPOINT_MARKER)) {
            return { hookPath, alreadyInstalled: true };
        }

        let content: string;
        if (existing.trim().length === 0) {
            content = `#!/bin/sh\n${script}`;
        } else {
            content = `${existing.replace(/\s*$/, '')}\n\n${script}`;
        }

        await fs.mkdir(path.dirname(hookPath), { recursive: true });
        await fs.writeFile(hookPath, content, { mode: 0o755 });

        return { hookPath, alreadyInstalled: false };
    }

    private async removeHook(
        hooksDir: string,
        hookName: string,
    ): Promise<boolean> {
        const hookPath = path.join(hooksDir, hookName);

        let content: string;
        try {
            content = await fs.readFile(hookPath, 'utf-8');
        } catch {
            return false;
        }

        if (!content.includes(CODY_CHECKPOINT_MARKER)) {
            return false;
        }

        const lines = content.split('\n');
        const startIdx = lines.findIndex(
            (line) => line.trim() === CODY_CHECKPOINT_MARKER,
        );
        if (startIdx === -1) {
            return false;
        }

        const endIdx = lines.findIndex(
            (line, idx) =>
                idx > startIdx && line.trim() === CODY_CHECKPOINT_END_MARKER,
        );

        const filtered =
            endIdx === -1
                ? lines.slice(0, startIdx)
                : [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)];

        const remaining = filtered
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\n*$/, '\n');

        if (remaining.trim() === '#!/bin/sh' || remaining.trim() === '') {
            await fs.unlink(hookPath);
        } else {
            await fs.writeFile(hookPath, remaining, { mode: 0o755 });
        }

        return true;
    }
}

export const gitHooksService = new GitHooksService();
