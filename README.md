# Genie Workspace

`genie-ops-center` — the production web app that delivers an organization's AI **solutions** to its users and lets admins govern who can reach them. One configurable Docker image, **one deployment per customer**.

See **[`docs/`](./docs/README.md)** for the full design: [what & why](./docs/epic-brief/index.md), [architecture](./docs/tech-plan/index.md), and the [implementation tickets](./docs/tickets/index.md).

> **Status: foundation built.** ✅ Scaffold + Ledger component kit · ✅ Identity + schema + migrations (better-auth) · ✅ Docker image · ✅ Auth flows & screens (sign-in, admin sign-in, forgot/reset/set-password, change-password, idle timeout). Next: the admin console, workspace, and chat (tickets 05+).

## Tech stack

- **Next.js 16** (app router) + TypeScript · **Tailwind v4** + **shadcn on Base UI** (not Radix) with the "Ledger" design tokens
- **tRPC** + **TanStack Query** (`@trpc/tanstack-react-query`) · **zod**
- **PostgreSQL** + **Drizzle ORM** / drizzle-kit
- **better-auth** (identity & sessions: email/password, additive `user`/`admin` roles, DB sessions, true 15-min idle timeout)
- **ai-sdk-ui** + **AI Elements** for chat (rendered with Streamdown) — _phase 4_
- **zustand** (complex client state) · **react-hook-form + zod** (forms)
- **oxlint** + **oxfmt**, pre-commit hook via [lefthook](https://lefthook.dev)

## Prerequisites

- **Node 24+** (current LTS; pinned via `engines` and `.nvmrc`) and **pnpm** (pinned via `packageManager`; enable with `corepack enable`)
- **Docker** (only to run the local dev database)

## Getting started

```bash
corepack enable             # enables the pnpm version pinned in package.json (once)
pnpm install                # installs deps + sets up the git pre-commit hook
cp .env.example .env        # DATABASE_URL already points at the dev DB below
pnpm db:dev                 # start the local Postgres container (persists in a volume)
pnpm db:migrate             # apply schema
pnpm dev                    # http://localhost:3000
```

The first time the app boots (or a container starts) against an empty DB, it seeds a bootstrap admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (set in `.env`), flagged `mustChangePassword`. Clear those after first boot.

### Dev database

A Postgres-in-container for local development is provided by [`docker-compose.dev.yml`](./docker-compose.dev.yml). It runs **only the database** — you run the app itself on your host with `pnpm dev`.

| Command                         | Does                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `pnpm db:dev`                   | Start the Postgres container (background)                     |
| `pnpm db:dev:stop`              | Stop it (data kept)                                           |
| `pnpm db:dev:down`              | Remove the container (data volume kept)                       |
| `pnpm db:dev:reset`             | **Wipe** the volume and start clean                           |
| `pnpm db:migrate` / `db:studio` | Apply migrations / open Drizzle Studio against `DATABASE_URL` |

It defaults to `genie:genie@localhost:5432/genie` (matching `.env.example`). Override credentials/port with a `.env` file (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).

### Dev vs production database

There is **one connection string — `DATABASE_URL`** — and it is the only thing that changes between environments:

- **Dev:** `DATABASE_URL=postgres://genie:genie@localhost:5432/genie` → the local container above.
- **Prod:** `DATABASE_URL=postgres://…your-managed/cloud/dedicated-Postgres…` (RDS, Cloud SQL, Crunchy, Neon, a bare-metal server, etc.).

No code changes between the two. The Drizzle client and drizzle-kit both read `DATABASE_URL`, so the same migrations and queries run against either.

**In production the app image does NOT run its own Postgres** — for performance, backups, and operational control the database is a separate, externally-managed resource. The container connects to the external `DATABASE_URL`, migrates-on-start under an advisory lock, then serves. See **[docs/deployment.md](./docs/deployment.md)** for the topology and required env.

### Compose files at a glance

| File                      | Use                                                                     | Runs Postgres?    |
| ------------------------- | ----------------------------------------------------------------------- | ----------------- |
| `docker-compose.dev.yml`  | **Local dev** — Postgres container only; you run `pnpm dev` on the host | Yes (throwaway)   |
| `docker-compose.app.yml`  | **Production-shape** — app image against your external DB               | **No** (external) |
| `docker-compose.full.yml` | **All-in-one smoke / fresh-deploy test** — app + Postgres               | Yes (ephemeral)   |

## Scripts

| Script                                                         | Does                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                                     | Next dev server (http://localhost:3000)                         |
| `pnpm build` / `start`                                         | Production build (`output: 'standalone'`) / serve               |
| `pnpm build:entrypoint`                                        | Bundle the container entrypoint (migrate+bootstrap) via esbuild |
| `pnpm typecheck`                                               | `tsc --noEmit`                                                  |
| `pnpm lint` / `lint:fix`                                       | oxlint                                                          |
| `pnpm format` / `format:check`                                 | oxfmt                                                           |
| `pnpm db:generate` / `db:migrate` / `db:studio`                | drizzle-kit migrations / studio                                 |
| `pnpm db:dev` / `db:dev:stop` / `db:dev:down` / `db:dev:reset` | local Postgres container lifecycle                              |

## Project structure

```
src/
  app/
    (auth)/        # sign-in, admin sign-in, forgot/reset/set/change-password ✅
    (workspace)/   # customer surface: Solutions hub, viewer, account   (phase 3)
    (admin)/       # Admin Portal: people, groups, solutions, themes    (phase 2)
    api/
      auth/[...all]/  # better-auth handler
      trpc/[trpc]/    # tRPC router
      chat/           # external SSE → ai-sdk chat proxy               (phase 4)
      health/         # /api/health
  components/ui/     # the Ledger component kit (shadcn-on-Base UI)
  components/        # idle-timeout + theme/provider
  lib/               # auth-client (better-auth/react) + client-safe password-strength
  server/
    auth.ts bootstrap.ts config.ts entrypoint.ts authz.ts
    trpc/            # router, procedures, guards (public/protected/admin)
    db/              # Drizzle client + schema (better-auth + domain tables)
    features/        # domain services (solution-access, user-service, password)
  trpc/              # client provider (TanStack Query + devtools)
drizzle/             # migration SQL + journal (drizzle-kit is sole owner)
docs/                # mirrored planning artifacts (see docs/README.md)
Dockerfile · docker-compose.{dev,app,full}.yml · lefthook.yml · entrypoint bundle
```

## Code quality & conventions

- A **pre-commit hook** runs `oxfmt --write` then `oxlint` on staged files and blocks the commit on lint errors.
- State & forms conventions (server state → TanStack Query, complex client → zustand, forms → react-hook-form + zod) and other working agreements live in **[`AGENTS.md`](./AGENTS.md)**.

## Deployment

Ships as a single configurable Docker image, one deployment per customer. The container connects to an **external** Postgres (`DATABASE_URL`), validates env, migrates-on-start under a Postgres advisory lock, seeds the first admin, then serves. **Postgres is not run in the image.** Full topology, env contract, and run recipes (compose / plain `docker run` / k8s) are in **[docs/deployment.md](./docs/deployment.md)**.
