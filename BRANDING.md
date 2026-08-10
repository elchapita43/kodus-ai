# Codus — Branding & Canonical Name Map

> Rebranded from **Kodus** (private fork of `kodustech/kodus-ai`). This file is
> the single source of truth for the rename. **When touching this repo, use the
> Codus names below and never reintroduce the old ones.**

## Canonical mappings (apply in this order)

| Old | New | Notes |
|---|---|---|
| `KODUS` (uppercase, env/constants) | `CODUS` | e.g. `KODUS_LICENSE_KEY` → `CODUS_LICENSE_KEY` |
| `Kodus` (display strings) | `Codus` | app name, emails, titles |
| `kodus` (identifiers/paths) | `codus` | routes, files, package names |
| `kodustech` (GitHub org / registry org) | `elchapita43` | repo URL, GHCR image paths |
| `Kody` / `kody` / `KODY` | `Cody` / `cody` / `CODY` | the AI agent + "Cody Rules" (was Kody Rules) |
| `kodus-ai-*` (images) | `codus-ai-*` | docker images |
| `kodus_*` (containers/DBs) | `codus_*` | `kodus_api`→`codus_api`, `kodus_db`→`codus_db`, `db_kodus_postgres`→`db_codus_postgres`, `db_kodus_mongodb`→`db_codus_mongodb` |
| `kodus_workflow`, `kodus_cross_process_events` (tables) | `codus_workflow`, `codus_cross_process_events` | via migration (old migrations stay historical) |
| `kodus-installer` / `kodus-source` (server dirs) | `codus-installer` / `codus-source` | server LAN |
| `kodus.io` | **KEEP** | external Kodus cloud endpoints (rules library, beacon) — not branding; telemetry stays disabled via `CODUS_TELEMETRY_DISABLED` |

## Guardrail (never break deploys)

- **Always build with `API_CLOUD_MODE=false`** (see skill `kodus-development`): `docker-bake.hcl` defaults it to `true` and cloud-mode images ignore the self-hosted license.
- License: DB org param `license_key` + instance keypair at `~/codus-installer/license/` (never regenerate the pair after baking — the public key in `LICENSE_PUBLIC_KEYS` must match).
- After any rename that touches code: `rg -i "kodus|kody"` must only hit the allowlist: `docs/changelog/`, `kodus.io`, historical migrations, `node_modules`, `dist`.
- Run `scripts/brand-check.sh` (CI/local) before considering a change done.

## Current deployment (server LAN)

- Source: `~/codus-source` (was `~/kodus-source`), branch `feat/learnings`.
- Installer: `~/codus-installer` (was `~/kodus-installer`), compose project `codus-installer`.
- Images: `codus-ai-{web,api,worker,webhook,mcp-manager}:local` → retagged `ghcr.io/elchapita43/codus-ai-*:latest`.
- Services/containers: `codus-web`→`codus-web-prod`, `api`→`codus_api`, `worker`→`codus-worker-prod`, `worker-analytics`, `webhooks`, `codus-mcp-manager`, `rabbitmq`, `db_codus_postgres`, `db_codus_mongodb`.
- Postgres: DB `codus_db`, role `codusdev`. Mongo: DB `codus` (dump/restored).
- CLI binary: `codus` (was `kodus`).
