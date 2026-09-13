# Genie Workspace

`genie-ops-center` is the web app that delivers an organization's AI **solutions** to its users and lets admins govern who can reach them. One configurable Docker image, **one deployment per customer**.

See **[`docs/`](./docs/README.md)** for the full design: [what & why](./docs/epic-brief/index.md), [architecture](./docs/tech-plan/index.md), and the [implementation tickets](./docs/tickets/index.md).

> **Implemented:** authentication and account sessions; admin People, Groups/Access, Solutions and Themes; workspace hub and favorites; embedded viewer; streaming chat with error feedback and retry; Docker startup migrations/bootstrap and a database-aware health check. Public signup is disabled. Native apps and the Everyone/protected-admin model remain planned. The admin overview and live chat theme application still have unfinished behavior tracked in Beads. The first Lighthouse deployment is running at https://opscenter.agilgenie.ai. See [deployment](./docs/deployment.md).

## Tech stack

- **Next.js 16.3.4** (app router) + TypeScript · **Tailwind v4** + **shadcn on Base UI** (not Radix) with the "Ledger" design tokens
- **tRPC** + **TanStack Query** (`@trpc/tanstack-react-query`) · **zod**
- **PostgreSQL** + **Drizzle ORM** / drizzle-kit
- **better-auth** (identity & sessions: email/password, additive `user`/`admin` roles, DB sessions, true 15-min idle timeout)
- **AI SDK** (`ai` + `@ai-sdk/react`) + local **AI Elements** components for chat (rendered with Streamdown)
- **zustand** (complex client state) · **react-hook-form + zod** (forms)
- **oxlint** + **oxfmt**, pre-commit hook via [lefthook](https://lefthook.dev)

## Prerequisites

- **Node 24** (`.nvmrc` selects major 24; `engines` permits >=24) and **pnpm 11.9.0** (`packageManager`). Run `nvm use` if using nvm; this repo does not install a shell auto-switch hook. Enable pnpm with `corepack enable`, or use `corepack pnpm` directly. Install Corepack separately if your Node distribution does not provide it.
- **Docker** + Docker Compose (to run the local database and the fresh-deploy smoke test)
- A **PostgreSQL** connection — either the local Docker DB (default, zero setup) or an external one (see [External DB](#connecting-an-external-database))

## Developing after cloning

```bash
# 1. Activate pnpm, clone and install (also installs the pre-commit hook)
corepack enable
git clone git@github.com:kenan-xin/genie-ops-center.git
cd genie-ops-center
pnpm install --frozen-lockfile

# 2. Copy the env template
cp .env.example .env
openssl rand -base64 32
# Paste the generated value into BETTER_AUTH_SECRET in .env.
# Set ADMIN_EMAIL and a strong ADMIN_PASSWORD for the first admin.
# The template documents every runtime and Docker Compose variable.

# 3. Start the local database and wait until it is ready
# Uses a persistent named volume; requires host port 5432 to be free.
docker compose -f docker-compose.local.yml up -d --wait

# 4. First initialization: use the optional bootstrap service. It uses the app
# image's migration/bootstrap entrypoint and reaches the DB as "db" internally.
docker compose -f docker-compose.local.yml --profile bootstrap up --build --wait

# 5. Stop and remove only the bootstrap app, keeping the initialized local DB.
docker compose -f docker-compose.local.yml stop bootstrap
docker compose -f docker-compose.local.yml rm -f bootstrap

# 6. Run Next on the host with hot reload, using .env's localhost DB URL.
pnpm dev    # http://localhost:3000
```

The initial container run seeds one admin only when the `user` table is empty and both bootstrap variables are supplied. Sign in at `/admin/login` and change the temporary password. Clear `ADMIN_PASSWORD` from `.env` after seeding. Removing the bootstrap app above also removes its saved container environment. An admin account still needs group grants to open workspace solutions.

**`pnpm dev` and `pnpm db:migrate` do not bootstrap an admin.** Once the database is initialized, daily startup is `pnpm db:local`, `pnpm db:migrate` when new migrations exist, then `pnpm dev`. If you change the local DB credentials, update both `.env`'s host URL and the container URL above. Changing Compose credentials does not change an existing PostgreSQL volume's credentials.

For local invite/reset testing, leave `RESEND_API_KEY` empty to log links in the **development** server console, or configure Resend for real delivery. The bootstrap image runs in production mode and does not log reset links. Generate secret values in the shell and paste them into `.env`; `.env` does not execute `$(...)` shell commands.

> **Tip — `next build` needs env present.** Server modules are evaluated during the build, so if you run `pnpm build` locally, set the same env (a throwaway `DATABASE_URL` + `BETTER_AUTH_SECRET` is fine — secrets aren't baked; the standalone server reads `process.env` at runtime).

### Daily commands

| Command                         | Does                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                      | Next dev server (http://localhost:3000)                         |
| `pnpm typecheck` / `lint` / `format` | `tsc --noEmit` / oxlint / oxfmt                             |
| `pnpm db:migrate`               | Apply new migrations to the dev DB                              |
| `pnpm db:generate`              | Generate a migration from schema changes (`src/server/db/schema.ts`) |
| `pnpm db:studio`                | Open Drizzle Studio against `DATABASE_URL`                      |
| `pnpm db:local` / `db:local:stop` | Start / stop the Postgres container (data kept)               |
| `pnpm db:local:down`              | Remove the container (data volume kept)                       |
| `pnpm db:local:reset`             | **Wipe** the volume and remove the container (does not restart it)                           |

The local DB defaults to `genie:genie@localhost:5432/genie` (matches `.env.example`). The template documents every app runtime variable and every Docker Compose helper variable; if you change `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, or `POSTGRES_PORT`, update `DATABASE_URL` to match.

## Connecting an external database

The Drizzle client, container migrator and drizzle-kit all read **`DATABASE_URL`**. Use a PostgreSQL service compatible with the schema and migration permissions; the bundled database examples use PostgreSQL 16. Public URLs, auth secrets and integration allowlists also vary by deployment.

- **Local Docker DB (default dev):** `DATABASE_URL=postgres://genie:genie@localhost:5432/genie` — the `pnpm db:local` container.
- **External / managed Postgres (staging, prod, or a cloud DB for dev):** point `DATABASE_URL` at it — RDS, Cloud SQL, Crunchy Bridge, Neon, Supabase, or a bare-metal server. Example:
  ```bash
  export DATABASE_URL="postgres://user:pass@db.host.example.com:5432/genie?sslmode=verify-full"
  pnpm db:migrate   # apply the schema to the external DB
  pnpm dev          # run against it (an admin must already have been bootstrapped)
  ```
  Use the TLS and certificate settings required by your database provider. Use a direct database connection for container startup migrations and advisory locking; transaction-mode poolers do not preserve the session-level lock.

**Production does NOT run Postgres inside the app image.** The database is a separate resource, which can be another container on the same server; the container connects to the external `DATABASE_URL`, migrates-on-start under a Postgres advisory lock, seeds the first admin, then serves. See **[docs/deployment.md](./docs/deployment.md)** for the full topology, env contract, and run recipes.

### Docker DB vs external DB at a glance

| Want to…                                  | Do this                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Develop locally after first initialization           | `pnpm db:local` (Docker Postgres) + the default `DATABASE_URL`          |
| Point dev/staging at a managed/cloud DB   | Set `DATABASE_URL` to it in `.env`, then `pnpm db:migrate`              |
| Test a full fresh deploy (app + DB image) | The smoke test below                                                     |

## Fresh-deploy smoke test

Stop the host dev server before this test. Use a disposable env and unused ports. The explicit `genie-smoke` Compose project isolates this test from the local project and volume. Its test volume is reused until removed; `down` preserves it and `down -v` deletes its data.

End-to-end test of a brand-new deployment: build the app image, start it with its own test Postgres, and verify the boot sequence (env validate → advisory-locked migrate → seed the first admin → serve). Use this before a release or to verify a Dockerfile/entrypoint change.

```bash
# 1. Required env for the run (use throwaway values — nothing is baked into the image)
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"   # ≥32 chars
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="Sup3rSecret!pw"                   # must pass the strength rule
export PUBLIC_BASE_URL="http://localhost:3000"
export APP_PORT=3000
export RESEND_API_KEY=""                               # no real email in this smoke test

# 2. Build + boot app + Postgres (reuses its named volume if one already exists)
docker compose -p genie-smoke -f docker-compose.smoke.yml up --build --wait

# 3. Wait for the app to be healthy, then watch the boot sequence
docker compose -p genie-smoke -f docker-compose.smoke.yml logs app | grep -E 'entrypoint|bootstrap|Ready'
# Expect:
#   [entrypoint] booting (config validated)
#   [entrypoint] advisory lock acquired
#   [entrypoint] applying drizzle migrations
#   [bootstrap] seeded initial admin admin@example.com (mustChangePassword set)…
#   [entrypoint] starting standalone server
#   ✓ Ready in …

# 4. Verify it serves
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/  # 307 to /login when signed out
curl -fsS http://localhost:3000/login     # sign-in page
curl -sS http://localhost:3000/api/health  # → {"status":"ok"}

# 5. Tear down (add -v to also wipe the test DB volume)
docker compose -p genie-smoke -f docker-compose.smoke.yml down
```

This uses [`docker-compose.smoke.yml`](./docker-compose.smoke.yml) — an **all-in-one smoke / fresh-deploy test only**, not the production topology (the Coolify deployment builds the Dockerfile and provisions PostgreSQL separately).

## Compose files at a glance

| File                      | Use                                                                     | Runs Postgres?    |
| ------------------------- | ----------------------------------------------------------------------- | ----------------- |
| `docker-compose.local.yml` | **Local dev** — Postgres plus an optional first-run bootstrap service; you run `pnpm dev` on the host | Yes (persistent local volume) |
| `docker-compose.smoke.yml` | **All-in-one smoke / fresh-deploy test** — app + Postgres               | Yes (persistent test volume)  |

## Scripts

| Script                                                         | Does                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                                     | Next dev server (http://localhost:3000)                         |
| `pnpm build` / `start`                                         | Next build / `next start` (does not run container startup steps)               |
| `pnpm build:entrypoint`                                        | Bundle the container entrypoint (migrate+bootstrap) via esbuild |
| `pnpm typecheck` / `typecheck:scripts`                          | Type-check app / standalone scripts                                                  |
| `pnpm lint` / `lint:fix`                                       | oxlint                                                          |
| `pnpm format` / `format:check`                                 | oxfmt                                                           |
| `pnpm db:generate` / `db:migrate` / `db:studio`                | drizzle-kit migrations / studio                                 |
| `pnpm db:local` / `db:local:stop` / `db:local:down` / `db:local:reset` | local Postgres container lifecycle                        |

`pnpm test` runs Vitest; `pnpm test:watch` watches tests. The standalone Docker server is started by its bundled entrypoint, not `pnpm start`. For local recovery of an **existing** dev admin, `pnpm reset-admin` resets its password and clears blocked lifecycle flags; it neither creates users nor migrates a database. Never point this development helper at production.

## Project structure

```
src/
  app/
    (auth)/        # sign-in, admin sign-in, forgot/reset/set/change-password ✅
    (workspace)/   # customer surface: Solutions hub, viewer, account
    (admin)/       # Admin Portal: people, groups, solutions, themes
    api/
      auth/[...all]/  # better-auth handler
      trpc/[trpc]/    # tRPC router
      chat/           # external SSE → ai-sdk chat proxy
      health/         # /api/health
  features/          # account, users, groups, solutions, themes, workspace/viewer, chat
  components/ai-elements/ # chat rendering primitives
  components/ui/     # the Ledger component kit (shadcn-on-Base UI)
  components/        # idle-timeout + theme/provider
  lib/               # auth-client (better-auth/react) + client-safe password-strength
  server/
    auth.ts bootstrap.ts config.ts entrypoint.ts authz.ts
    trpc/            # router, procedures, guards (public/protected/admin)
    db/              # Drizzle client + schema (better-auth + domain tables)
    features/        # remaining shared server helpers (solution-access, password)
  trpc/              # client provider (TanStack Query + devtools)
drizzle/             # migration SQL + journal (drizzle-kit is sole owner)
docs/                # operational guides + historical design/plans (see docs/README.md)
Dockerfile · docker-compose.{dev,app,full}.yml · lefthook.yml · entrypoint bundle
```

## Code quality & conventions

- A **pre-commit hook** runs `oxfmt --write` on staged JS/TS/JSON and `oxlint` on staged JS/TS and blocks the commit on lint errors.
- State & forms conventions (server state → TanStack Query, complex client → zustand, forms → react-hook-form + zod) and other working agreements live in **[`AGENTS.md`](./AGENTS.md)**.

## Deployment

Ships as a single configurable Docker image, one deployment per customer. The container connects to an **external** Postgres (`DATABASE_URL`), validates env, migrates-on-start under a Postgres advisory lock, seeds the first admin, then serves. **Postgres is not run in the image.** Coolify topology, env contract, and Compose / `docker run` examples are in **[docs/deployment.md](./docs/deployment.md)**.
