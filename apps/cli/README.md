<!-- TODO: Add banner image/logo here -->

<h1 align="center">Codus CLI</h1>

<p align="center">
  <strong>Catch bugs before they reach your pull request — AI code review from the terminal.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@codus/cli"><img src="https://img.shields.io/npm/v/@codus/cli.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@codus/cli"><img src="https://img.shields.io/npm/dm/@codus/cli.svg" alt="npm downloads"></a>
  <a href="https://github.com/elchapita43/cli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/elchapita43/cli" alt="license"></a>
  <a href="https://github.com/elchapita43/cli"><img src="https://img.shields.io/github/stars/elchapita43/cli" alt="stars"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="node version"></a>
</p>

<p align="center">
  <a href="https://kodus.io">Website</a> &middot;
  <a href="https://app.kodus.io">Sign Up</a> &middot;
  <a href="https://github.com/elchapita43/cli/issues">Issues</a>
</p>

---

```bash
yarn global add @codus/cli
```

---

## Quick Start

```bash
# 1. Install
yarn global add @codus/cli

# 2. Authenticate (or skip for trial mode — no account needed)
codus auth login

# 3. Review your code
codus review
```

That's it. Codus analyzes your changes, finds issues, and lets you fix them interactively — or auto-fix everything at once with `codus review --fix`.

<!-- TODO: Add demo GIF showing interactive review in action -->

## What It Does

### Code Review

Analyze local changes, staged files, commits, or branch diffs. Codus finds bugs, security issues, performance problems, and style violations — then suggests fixes with real code.

```bash
codus review                    # Review working tree changes (interactive)
codus review --staged           # Only staged files
codus review --branch main      # Compare against a branch
codus review --fix              # Auto-apply all fixable issues
codus review --prompt-only      # Structured output for AI agents
```

Reviews are **context-aware** — Codus reads your `.cursorrules`, `claude.md`, and `.codus.md` so suggestions follow your team's standards. [More on review modes](#review-modes)

### Cody Rules

Create, update, and inspect the Cody Rules that guide Codus behavior for your team.

```bash
codus rules create --title "Use async/await" --rule "Prefer async/await over raw promises" --repo-id global --severity high --scope file --path "**/*.ts"
codus rules update --uuid <uuid> --repo-id global --severity critical
codus rules view --repo-id global
```

`codus rules update` requires `--uuid`.

Defaults:

- `repo-id` defaults to `global`
- `severity` defaults to `medium`
- `scope` defaults to `file`
- `path` is optional (omitted means all files)

### PR Suggestions

Fetch AI-powered suggestions for open pull requests directly from your terminal.

```bash
codus pr suggestions --pr-url https://github.com/org/repo/pull/42
codus pr suggestions --pr-number 42 --repo-id <id>
```

Filter by severity, export as JSON or Markdown, or pipe into an AI agent with `--prompt-only` for automated fixes.

### Business Validation (Local Diff vs Task)

Run Codus business-rules validation directly from your local diff with optional task reference.

```bash
# Working tree diff (default)
codus pr business-validation

# Staged-only with explicit task reference
codus pr business-validation --staged --task-id KC-1441

# Branch or files scope
codus pr business-validation --branch main --task-id KC-1441
codus pr business-validation src/service.ts src/use-case.ts --task-id KC-1441
```

### Decision Memory

AI agents make dozens of decisions per session — architecture choices, trade-offs, why approach X was picked over Y. Without a record, that reasoning vanishes when the session ends.

Codus captures agent decisions into your repo as structured markdown. When you or another agent return to the code, the full context is there.

```bash
codus decisions enable           # Install hooks + initialize config
codus decisions status           # See what's been captured
codus decisions show [name]      # View PR or module memory
codus decisions promote          # Promote decisions to long-term memory
```

Stored in `.cody/pr/by-sha/<head-sha>.md` — versioned with your code, readable by humans and agents. [More on decision memory](#decision-memory-1)

---

## Best With AI Agents

Codus is designed to work **inside AI coding agents**. While you can use it standalone, the real power comes when your agent runs reviews automatically and fixes issues in a loop — no manual intervention needed.

**Works with:** Claude Code, Cursor, Windsurf, GitHub Copilot, Gemini CLI, and 20+ more environments.

### Install the Skill (recommended)

The fastest way to get started. Auto-detects your installed IDEs and sets everything up:

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/elchapita43/cli/main/install.sh | bash
```

Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$tmp = Join-Path $env:TEMP 'codus-install.ps1'; Invoke-WebRequest https://raw.githubusercontent.com/elchapita43/cli/main/install.ps1 -OutFile $tmp; & $tmp"
```

This installs the Codus CLI globally and deploys the review skill into every supported agent on your machine — Claude Code, Cursor, Windsurf, and others. One command, all environments.

### How It Works With Agents

Once installed, your AI agent can autonomously:

1. **Write code** as usual
2. **Run `codus review --prompt-only`** to analyze changes
3. **Read the structured output** and understand each issue
4. **Fix the issues** automatically
5. **Repeat** until the review is clean

This creates a tight feedback loop: the agent writes, reviews, and fixes — all without leaving your IDE.

Beyond reviews, Codus also captures **what your agent decided and why** via [Decision Memory](#decision-memory). Every reasoning step is saved into your repo — so when you (or another agent) pick up the work later, the full context is already there. No more re-explaining what was done or losing decisions between sessions.

### Setup: Claude Code

Add to your project's `CLAUDE.md`:

```markdown
## Code Review

After implementing changes, run `codus review --prompt-only` to check for issues.
If issues are found, fix them and re-run until clean.
```

Or use the skill directly — after installing via the command above, just ask Claude Code to review your code and it will use Codus automatically.

### Setup: Cursor / Windsurf

Add to your `.cursorrules` or equivalent:

```
When writing code:
1. Implement the feature
2. Run: codus review --prompt-only
3. If issues are found, fix them automatically
4. Repeat until review is clean
5. Show final result
```

### Setup: Headless / Shared Environments

Set a team key so agents and shared machines are authenticated without individual logins:

```bash
export CODUS_TEAM_KEY=codus_xxxxx
codus review --prompt-only
```

Works with Codex, CI runners, remote dev environments, and any context where personal login isn't practical. Get your key at [app.kodus.io/organization/cli-keys](https://app.kodus.io/organization/cli-keys).

### Copy & Paste Workflow (interactive)

If you prefer manual control:

1. Run `codus review`
2. Navigate to a file with issues
3. Select **"Copy fix prompt for AI agent"**
4. Paste into Claude Code or Cursor — the AI fixes it

The copied prompt includes file path, line numbers, severity, and detailed suggestions — optimized for AI agents.

## Installation

### Skill installer (recommended — CLI + all your agents)

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/elchapita43/cli/main/install.sh | bash
```

Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$tmp = Join-Path $env:TEMP 'codus-install.ps1'; Invoke-WebRequest https://raw.githubusercontent.com/elchapita43/cli/main/install.ps1 -OutFile $tmp; & $tmp"
```

Installs the CLI and deploys the review skill to all detected agents in one step.

### Keep everything updated

`codus update` updates the CLI package.

For end users, the recommended way to refresh skills and agent integrations is:

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/elchapita43/cli/main/install.sh | bash
```

Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$tmp = Join-Path $env:TEMP 'codus-install.ps1'; Invoke-WebRequest https://raw.githubusercontent.com/elchapita43/cli/main/install.ps1 -OutFile $tmp; & $tmp"
```

Fallback via CLI for common local agent roots:

```bash
codus skills install        # install into detected local agent roots
codus skills resync         # re-sync/refresh managed skills
codus skills uninstall      # remove managed skills from detected targets
```

If you want to inspect the script before execution:

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/elchapita43/cli/main/install.sh -o /tmp/codus-install.sh
less /tmp/codus-install.sh
bash /tmp/codus-install.sh
```

Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest https://raw.githubusercontent.com/elchapita43/cli/main/install.ps1 -OutFile install.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

### CLI only

<details>
<summary><strong>yarn</strong></summary>

```bash
yarn global add @codus/cli
```

</details>

<details>
<summary><strong>npx (no install)</strong></summary>

```bash
npx @codus/cli review
```

</details>

<details>
<summary><strong>curl</strong></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/elchapita43/cli/main/install.sh | bash
```

</details>

<details>
<summary><strong>PowerShell</strong></summary>

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$tmp = Join-Path $env:TEMP 'codus-install.ps1'; Invoke-WebRequest https://raw.githubusercontent.com/elchapita43/cli/main/install.ps1 -OutFile $tmp; & $tmp"
```

</details>

<details>
<summary><strong>Homebrew (coming soon)</strong></summary>

```bash
brew install codus/tap/codus
```

</details>

## Agent Mode

Codus now supports an explicit **agent mode** for deterministic automation output.

### Global flag

Use `--agent` on any command to return a stable JSON envelope:

```json
{
    "ok": true,
    "command": "review",
    "data": {},
    "error": null,
    "meta": {
        "schemaVersion": "1.0",
        "cliVersion": "x.y.z",
        "mode": "agent",
        "durationMs": 123
    }
}
```

### Command schema introspection

```bash
codus schema
codus schema --command "pr suggestions"
```

### Field selection for smaller payloads

Available on `review` and `pr suggestions`:

```bash
codus review --agent --fields summary,issues.file,issues.line
codus pr suggestions --agent --pr-url https://github.com/org/repo/pull/42 --fields summary,issues.file
```

`--fields` requires `--agent` or `--format json`.

### Dry-run for mutable commands

```bash
codus hook install --dry-run
codus hook uninstall --dry-run
codus decisions enable --dry-run
codus decisions disable --dry-run
codus decisions promote --dry-run
```

Dry-run prints the planned actions and does not mutate local hooks/config/files.

## Review Modes

### Interactive (default)

```bash
codus review
```

Navigate files with issue counts, preview fixes before applying, and copy AI-friendly prompts to paste into Claude Code or Cursor.

### Auto-fix

```bash
codus review --fix
```

Applies all fixable issues at once. Shows a confirmation prompt before making changes.

### AI Agent

```bash
codus review --prompt-only
```

Minimal, structured output designed for Claude Code, Cursor, and Windsurf. Perfect for autonomous generate-review-fix loops.

<details>
<summary><strong>More: output formats &amp; flags</strong></summary>

#### Output Formats

```bash
codus review                           # Interactive (default)
codus review --format json             # JSON output
codus review --format markdown         # Markdown report
codus review --prompt-only             # AI agent output
codus review --format markdown -o report.md  # Save to file
```

#### Output Streams

- `stdout`: command result/payload (for example JSON/Markdown reports)
- `stderr`: debug traces (`--verbose`), spinner/progress messages, and errors

This keeps machine-readable output clean for piping:

```bash
codus review --format json > review.json
codus review --format json --verbose 1>review.json 2>review.debug.log
```

#### Diff Targets

```bash
codus review                           # Working tree changes
codus review --staged                  # Staged files only
codus review --commit HEAD~1           # Specific commit
codus review --branch main             # Compare against branch
codus review src/index.ts src/utils.ts # Specific files
```

#### All Flags

| Flag                   | Description                                   |
| ---------------------- | --------------------------------------------- |
| `--staged`             | Analyze only staged files                     |
| `--commit <sha>`       | Analyze a specific commit                     |
| `--branch <name>`      | Compare against a branch                      |
| `--rules-only`         | Only check configured rules                   |
| `--fast`               | Faster analysis for large diffs               |
| `--fix`                | Auto-apply all fixable issues                 |
| `--prompt-only`        | AI agent optimized output                     |
| `--context <file>`     | Include custom context file                   |
| `--format <fmt>`       | Output format: `terminal`, `json`, `markdown` |
| `--output <file>`      | Save output to file                           |
| `--fail-on <severity>` | Exit code 1 if issues meet or exceed severity |
| `-i, --interactive`    | Explicitly enable interactive mode            |

</details>

## Decision Memory

Full reference for the decision capture system ([intro above](#decision-memory)).

```bash
# Enable with specific agents
codus decisions enable --agents claude,cursor,codex

# Custom Codex config path
codus decisions enable --agents codex --codex-config ~/.codex/config.toml

# Overwrite existing config
codus decisions enable --force

# Check what's been captured on current branch
codus decisions status

# View decisions for a PR or specific module
codus decisions show [name]

# Promote PR-level decisions to long-term module memory
codus decisions promote --branch feat/auth --modules auth,users

# Disable hooks (preserves all captured data in .cody/)
codus decisions disable
```

**How it works:** Hooks fire on agent turn-complete events and persist decisions to `.cody/pr/by-sha/<head-sha>.md`. Files are committed to your repo, versioned with your code, readable by humans and agents.

**Supported agents:** Claude Code, Cursor, Codex.

## CI/CD & Git Hooks

### Pre-push Hook

```bash
codus hook install --fail-on error   # Block pushes with errors
codus hook status                     # Check hook status
codus hook uninstall                  # Remove hook
```

### Pipeline Usage

```bash
# Strict rules check with JSON output
codus review --rules-only --format json --fail-on error

# Generate markdown report artifact
codus review --format markdown --output review-report.md
```

## Authentication

Codus supports multiple auth methods depending on your setup:

### Trial Mode (no account)

Just run `codus review`. No signup needed. You get 5 reviews/day with up to 10 files and 500 lines per file — enough to try it out. [Sign up free](https://app.kodus.io) to remove limits.

### Personal Login

For individual developers. Creates a session with automatic token refresh.

```bash
codus auth login           # Sign in with email/password
codus auth status          # Check auth status and usage
codus auth logout          # Sign out
```

Credentials are stored locally in `~/.codus/credentials.json`.

### Team Key

For teams where not everyone needs their own account. A single shared key gives the whole team access — developers just set the key and start reviewing, no individual signup required.

```bash
codus auth team-key --key codus_xxxxx
```

Or set it as an environment variable:

```bash
export CODUS_TEAM_KEY=codus_xxxxx
```

Get your team key at [app.kodus.io/organization/cli-keys](https://app.kodus.io/organization/cli-keys). Team keys have configurable device limits managed from the dashboard.

This is also the recommended auth method for AI coding agents (Claude Code, Cursor, Codex) — set the env var once and every agent session is authenticated automatically.

### Repository Configuration

Repository configuration requires team-key auth:

- team keys work across `add`, `list`, `show`, `setup`, `set`, and pattern mutations through the CLI config endpoints

These commands always read and update the repository's current settings directly. There is no reset-to-default flow in the CLI.

`codus config -r` and `codus config --remote` are shortcuts for `codus config remote add`.

```bash
codus config -r .                       # Shortcut for: codus config remote add .
codus config --remote .                 # Shortcut for: codus config remote add .
codus config --remote . --json          # Add and print machine-readable result
codus config --remote . --no-prompt     # Add without starting setup
codus config remote add .               # Add the current repository explicitly
codus config remote show .              # Inspect current repository settings
codus config remote setup .             # Run guided setup again
codus config remote setup . --json      # Print structured setup result
codus config remote set . review.enabled true
codus config remote set . review.enabled true --json
codus config remote set . patterns.ignoreFiles "**/*.lock,dist/**"
codus config remote add-pattern . ignore-files "dist/**"
codus config remote add-ignore-file . "dist/**"
codus config remote remove-base-branch . "release/*"
codus config remote remove-pattern . base-branches "release/*"
codus config remote open . --section suggestion-control
codus config remote list --json
codus config remote list                # List repositories already configured
```

When a repository is added from an interactive terminal, Codus offers a guided setup for:

- automated review
- auto approve
- minimum severity level
- ignored file patterns
- base branch patterns
- ignored title patterns

Pattern fields accept glob expressions such as `**/*.lock`, `dist/**`, `release/*`, and `draft*`.

Use `codus config remote open` when you need advanced repository settings that are still web-only. The CLI opens the Codus app and prints the repository/section path to navigate.

Use `--json` with `show`, `set`, `open`, `add-pattern`, `remove-pattern`, and the pattern aliases when you need stable machine-readable output for scripts or AI agents.

When targeting a repository that is different from your current working directory, pass `owner/repo` explicitly instead of `.`:

```bash
codus config -r Wellington01/codus-extension
codus config remote show Wellington01/codus-extension
```

#### Local API note

When testing against the local backend with `yarn start:local`, repository configuration works with a team key when the local API exposes:

- `GET /cli/config/repositories/available`
- `GET /cli/config/repositories/selected`
- `POST /cli/config/repositories`
- `GET /cli/config/repositories/:repositoryId/settings`
- `PATCH /cli/config/repositories/:repositoryId/settings`

```text
Repository configuration access denied: ...
```

Example local commands:

```bash
export CODUS_TEAM_KEY=codus_xxxxx
yarn start:local config -r Wellington01/codus-extension --no-prompt
yarn start:local config remote list --json
yarn start:local config remote show Wellington01/codus-extension
```

### CI/CD Token

For pipelines and automated environments. Generated from your personal login:

```bash
codus auth token           # Generate a CI/CD token
```

Then use it in your pipeline:

```bash
export CODUS_TOKEN=<your-token>
codus review --format json --fail-on error
```

> **Note:** For PR-level reviews in CI/CD, we recommend using the [Codus platform](https://app.kodus.io) GitHub/GitLab integration instead of the CLI. It's purpose-built for PR workflows with inline comments, status checks, and team dashboards.

<details>
<summary><strong>Environment variables</strong></summary>

| Variable         | Description                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| `CODUS_API_URL`  | API endpoint (default: `https://api.kodus.io`). HTTPS only (except localhost). |
| `CODUS_APP_URL`  | Optional Codus app URL override for `codus config remote open`.                |
| `CODUS_TOKEN`    | CI/CD token for automated pipelines (generated via `codus auth token`)         |
| `CODUS_TEAM_KEY` | Team key for shared team access and AI coding agents                           |

</details>

## Privacy & Security

Codus sends your code diffs to the Codus API for analysis. We take this seriously:

- **HTTPS only** — All API communication is encrypted. Custom API URLs are validated.
- **No training on your code** — Your code is not used to train models.
- **Minimal data** — Only diffs and context files are sent, not your entire codebase.
- **Credentials stored locally** — Auth tokens are kept in `~/.codus/credentials.json` on your machine.

## Contributing

We welcome contributions! Please see our [issues page](https://github.com/elchapita43/cli/issues) to get started.

```bash
yarn install      # Install dependencies
yarn build        # Build
yarn dev          # Watch mode
yarn test         # Run tests
```

## License

[MIT](LICENSE)
