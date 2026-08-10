---
name: codus-review
description: Use when the user wants Codus to review local changes, run `codus review` or `--prompt-only`, fix Codus review findings, or check commit, push, or merge readiness.
---

# Codus Review

## Goal

Use the Codus CLI to review changes and resolve issues. Prefer machine-friendly output via `--prompt-only`, then apply fixes in code.

If the request is to validate local changes against business rules, task requirements, or acceptance criteria, use `codus-business-rules-validation` instead. `codus review` does not trigger local business validation.

## Trigger Hints

- Treat mentions of `review`, `commit`, `push`, `open PR`, `merge`, `quality gate`, or `ready to ship` as triggers for this skill.
- For commit/push/merge requests, proactively ask to run Codus review first when a fresh review has not run yet in the current task.

## Workflow

1. Ensure Codus CLI is available.

- Run `codus --help` to confirm.
- If missing, ask the user to install the CLI and stop.

2. Ensure authentication if required.

- If `codus review` fails with auth, ask the human to authenticate with `codus auth login` in their terminal, then retry after they confirm.
- For team keys, use `codus auth team-key --key <key>` when provided by the user.

3. Run review using prompt-only output.

- Default: `codus review --prompt-only`.
- If user specifies files: `codus review --prompt-only <files...>`.
- If user asks for staged/commit/branch: add `--staged`, `--commit <sha>`, or `--branch <name>`.
- If user wants fast: add `--fast`.

4. Parse results and apply fixes.

- Use the output to locate files and lines.
- Make minimal, targeted changes to address each issue.
- If an issue is not actionable or is a false positive, explain why and skip.

5. Re-run review if needed.

- After fixes, rerun `codus review --prompt-only` to confirm issues are resolved.

## Notes

- Prefer `--prompt-only` for predictable parsing.
- Avoid `--interactive` unless the user explicitly asks.
- Redirect PR-vs-task validation requests to `codus-business-rules-validation`.
- Use `review --help` to undertstand review possibilities
