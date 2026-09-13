---
kind: ticket
title: "03b · Docker image & runtime config"
status: 2
---

# 03b · Docker image & runtime config

The deployable artifact: a single configurable Docker image that a customer runs. This is the epic's primary delivery target ("deployable via Docker image").

## Scope — in

- **Dockerfile**: multi-stage (deps → build → minimal standalone runner) on **`node:24`** (current LTS, pinned via `engines`/`.nvmrc`), using Next.js `output: 'standalone'`; `.dockerignore`; non-root runtime user.
- **Entrypoint**: on container start — acquire a Postgres **advisory lock**, run **`drizzle migrate`** (the only migration path), run the **guarded bootstrap** (seed admin if `user` table empty — logic from [03](../03-identity-schema-migrations/index.md)), release the lock, then start the server. Safe when multiple replicas start together.
- **Runtime config module**: all env consolidated and **zod-validated at boot (fail fast)** — `DATABASE_URL`, better-auth secret + base URL, `GENIE_CHAT_API_ALLOWED_ORIGINS`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`. (The chat streaming endpoint itself is **per-solution config**; the env is the approved-origins allow-list — see ticket 08.)
- **Local dev**: `docker-compose.yml` (app + Postgres) for one-command local run; a lightweight `/api/health` healthcheck.
- Document the **per-deployment env contract** (one image, one deployment per customer).

## Scope — out

- Cloud orchestration (k8s/CI-CD), monitoring/observability, TLS termination — out of foundation (single self-hosted image only).
- **Build stage must `pnpm install --frozen-lockfile`** (no `.git` in the build context → `prepare`'s `simple-git-hooks` would no-op anyway; the `@better-auth/cli generate` `server-only` quirk is a one-time authoring step, not run at build). Package manager is **pnpm** (pinned via `packageManager`); the build stage installs via Corepack.

## Governs

[tech-plan](../../tech-plan/index.md) (Operational: build, migrations, bootstrap, config/secrets).

## Depends on

[01 · Scaffold & infra](../01-scaffold-infra/index.md) (app to containerize), [03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md) (migrations + bootstrap to run). Can be authored against 01 early; verified end-to-end once 03 lands. Runs in parallel with 04/05.

## Acceptance / guardrails

- **Fresh-deploy smoke test**: `docker run` against an _empty_ Postgres → container migrates, seeds the bootstrap admin (with `mustChangePassword`), and serves the sign-in screen — a brand-new deployment is usable end-to-end.
- Migrations run **under the advisory lock** so concurrent replica starts don't double-migrate; boot **fails fast** on missing/invalid env.
- Secrets are supplied only via env — **never baked into the image**; runtime user is non-root.
