# Codus Skills

This directory contains the agent skills shipped with the Codus CLI repository.

## Included Skills

- `codus-review`
    - Run local Codus code review for workspace changes with the installed CLI.
- `codus-review-dev`
    - Run the local Codus CLI build against a dev/localhost API using `scripts/run-local-cli.sh` (explicit dev request only).
- `codus-business-rules-validation`
    - Canonical skill name for business rules validation in installers and multi-agent integrations.
- `codus-pr-suggestions-resolver`
    - Fetch PR suggestions and apply fixes with judgment.
- `codus-centralized-config`
    - Manage centralized config from CLI (status, init, sync, disable, download).
- `hunk-review` (vendored from [`hunkdiff`](https://github.com/modem-dev/hunk))
    - Drive a live Hunk diff review session: inspect, navigate, reload, and add inline comments via `hunk session ...`. Pairs with `codus diff` and the hunk-backed `codus review` viewer.

## Trigger Map (recommended)

- User mentions `review`, `commit`, `push`, `open PR`, `merge`, `quality gate`
    - Prefer `codus-review` (or `codus-review-dev` for local dev CLI flow).
    - If the request is delivery action (commit/push/merge) and no fresh review ran, ask to run Codus review first.
- User explicitly mentions local/dev CLI execution (`node dist/index.js`, `localhost:3001`, `CODUS_API_URL`, dev API/QA API)
    - Use `codus-review-dev` instead of `codus-review`.
- User mentions `business validation`, `acceptance criteria`, `local diff vs task`, `implementation vs task`, `codus pr business-validation`
    - Use `codus-business-rules-validation`.
- User asks to apply Codus PR suggestions
    - Use `codus-pr-suggestions-resolver`.
- User asks to validate local implementation against a task, acceptance criteria, or business rules
    - Use `codus-business-rules-validation`.
- User asks to enable/disable/sync/download centralized config or choose centralized config source repository
    - Use `codus-centralized-config`.
- User has a Hunk session open or asks to navigate / comment / reload a live Hunk diff
    - Use `hunk-review`. Triggers also include "abrir hunk", "hunk session", "comentar no hunk".

## Notes

- Skill source lives in `skills/<skill-name>/SKILL.md`.
- Some skills include helper scripts in `skills/<skill-name>/scripts/`.
- Packaging these files in the npm artifact makes them available to external installers and local integration tooling.
- Shipping the files here does not, by itself, install them into Claude Code, Cursor, Codex, or other agents. That installation step still depends on the integration tooling you use.
- `codus skills install` installs bundled skills in detected local agent roots.
- `codus skills resync` re-syncs bundled skills in detected local agent directories.
- `codus skills uninstall` removes bundled managed skills from detected local agent directories.
- For full multi-agent bootstrap/setup, use the platform installer tooling (`install.sh` for macOS/Linux, `install.ps1` for Windows PowerShell).

## For Integrators

- Validate skill structure and metadata:
    - `npm run skills:validate`
- Sync legacy alias folders from canonical skills:
    - `npm run skills:sync`
- Generate prompt metadata as XML (`<available_skills>`):
    - `npm run skills:prompt`
- Generate prompt metadata as JSON:
    - `npm run skills:prompt:json`

Recommended injection pattern:

1. Run `npm run skills:prompt` during session bootstrap or before each agent request.
2. Inject the XML payload into your system/developer prompt under a section such as `Available skills`.
3. Map user intent to the listed skill `name` and load the corresponding `SKILL.md` only when needed.
