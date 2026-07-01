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

- **Node 24+** (current LTS; pinned via `engines` and `.nvmrc`) and **pnpm** (pinned via `packageManager`; enable once with `corepack enable`)
- **Docker** + Docker Compose (to run the local database and the fresh-deploy smoke test)
- A **PostgreSQL** connection — either the local Docker DB (default, zero setup) or an external one (see [External DB](#connecting-an-external-database))

## Developing after cloning

```bash
# 1. Install pnpm (once per machine) — matches the version pinned in package.json
corepack enable

# 2. Clone & install deps (also installs the lefthook pre-commit hook)
git clone git@github.com:kenan-xin/genie-ops-center.git
cd genie-ops-center
pnpm install

# 3. Configure env — copy the template and fill in the required secrets
cp .env.example .env
#    At minimum set in .env:
#      BETTER_AUTH_SECRET="$(openssl rand -base64 32)"   # ≥32 chars, required
#      ADMIN_EMAIL=...                                    # first-admin bootstrap
#      ADMIN_PASSWORD=...                                 #   (strength-checked; clear after first boot)
#    DATABASE_URL already points at the local Docker DB below.

# 4. Start the dev database (Postgres in a container, data in a volume)
pnpm db:dev

# 5. Apply migrations (creates all tables)
pnpm db:migrate

# 6. Run the app on your host
pnpm dev    # → http://localhost:3000
```

On first boot against an empty DB, the app seeds a bootstrap admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, flagged `mustChangePassword` (you'll be prompted to change it on first sign-in). Clear `ADMIN_PASSWORD` from the env after that first boot.

> **Tip — `next build` needs env present.** Server modules are evaluated during the build, so if you run `pnpm build` locally, set the same env (a throwaway `DATABASE_URL` + `BETTER_AUTH_SECRET` is fine — secrets aren't baked; the standalone server reads `process.env` at runtime).

### Daily commands

| Command                         | Does                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                      | Next dev server (http://localhost:3000)                         |
| `pnpm typecheck` / `lint` / `format` | `tsc --noEmit` / oxlint / oxfmt                             |
| `pnpm db:migrate`               | Apply new migrations to the dev DB                              |
| `pnpm db:generate`              | Generate a migration from schema changes (`src/server/db/schema.ts`) |
| `pnpm db:studio`                | Open Drizzle Studio against `DATABASE_URL`                      |
| `pnpm db:dev` / `db:dev:stop`   | Start / stop the Postgres container (data kept)                 |
| `pnpm db:dev:down`              | Remove the container (data volume kept)                         |
| `pnpm db:dev:reset`             | **Wipe** the volume and start clean                             |

The dev DB defaults to `genie:genie@localhost:5432/genie` (matches `.env.example`). Override via `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`.

## Connecting an external database

There is **one connection string — `DATABASE_URL`** — and it's the only thing that changes between environments. The Drizzle client, the migrator, and drizzle-kit all read it, so the **same code and migrations run against any Postgres**.

- **Local Docker DB (default dev):** `DATABASE_URL=postgres://genie:genie@localhost:5432/genie` — the `pnpm db:dev` container.
- **External / managed Postgres (staging, prod, or a cloud DB for dev):** point `DATABASE_URL` at it — RDS, Cloud SQL, Crunchy Bridge, Neon, Supabase, or a bare-metal server. Example:
  ```bash
  DATABASE_URL="postgres://user:pass@db.host.example.com:5432/genie?sslmode=require"
  pnpm db:migrate   # apply the schema to the external DB
  pnpm dev          # run against it
  ```
  If your external DB requires `sslmode`, append it to the URL (`?sslmode=require` / `verify-full`).

**Production does NOT run Postgres inside the app image.** For performance, backups, and operational control, the database is a separate, externally-managed resource; the container connects to the external `DATABASE_URL`, migrates-on-start under a Postgres advisory lock, seeds the first admin, then serves. See **[docs/deployment.md](./docs/deployment.md)** for the full topology, env contract, and run recipes.

### Docker DB vs external DB at a glance

| Want to…                                  | Do this                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Develop locally with zero setup           | `pnpm db:dev` (Docker Postgres) + the default `DATABASE_URL`            |
| Point dev/staging at a managed/cloud DB   | Set `DATABASE_URL` to it in `.env`, then `pnpm db:migrate`              |
| Run the prod-shaped app image             | `docker compose -f docker-compose.app.yml up -d --build` (external DB)  |
| Test a full fresh deploy (app + DB image) | The smoke test below                                                     |

## Fresh-deploy smoke test

End-to-end test of a brand-new deployment: build the app image, start it with its own ephemeral Postgres, and verify the boot sequence (env validate → advisory-locked migrate → seed the first admin → serve). Use this before a release or to verify a Dockerfile/entrypoint change.

```bash
# 1. Required env for the run (use throwaway values — nothing is baked into the image)
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"   # ≥32 chars
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="Sup3rSecret!pw"                   # must pass the strength rule
# Optional: export BETTER_AUTH_URL="http://localhost:3000"  (default)

# 2. Build + boot app + ephemeral Postgres on a fresh volume
docker compose -f docker-compose.full.yml up --build -d

# 3. Wait for the app to be healthy, then watch the boot sequence
docker logs genie-app | grep -E 'entrypoint|bootstrap|Ready'
# Expect:
#   [entrypoint] booting (config validated)
#   [entrypoint] advisory lock acquired
#   [entrypoint] applying drizzle migrations
#   [bootstrap] seeded initial admin admin@example.com (mustChangePassword set)…
#   [entrypoint] starting standalone server
#   ✓ Ready in …

# 4. Verify it serves
curl -sS http://localhost:3000/            # → 200 (sign-in page)
curl -sS http://localhost:3000/api/health  # → {"status":"ok"}

# 5. Tear down (add -v to also wipe the ephemeral DB volume)
docker compose -f docker-compose.full.yml down
```

This uses [`docker-compose.full.yml`](./docker-compose.full.yml) — an **all-in-one smoke / fresh-deploy test only**, not the production topology (prod uses [`docker-compose.app.yml`](./docker-compose.app.yml) against an external DB).

> **App-only smoke (prod-shaped):** to verify the image against an *already-running* external Postgres, use `docker-compose.app.yml` with `DATABASE_URL` pointed at it instead — it runs the app image with no `db` service.

## Compose files at a glance

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
