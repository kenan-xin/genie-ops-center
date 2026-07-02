# Production deployment

**Topology: the app runs in a container; the database does not.** One configurable Docker image, one deployment per customer. Postgres is a separate, externally-managed resource — a managed service (RDS, Cloud SQL, Crunchy Bridge, Neon, …) or a dedicated/bare-metal server — chosen and tuned for performance, backups, and operational control. The image **never** runs its own Postgres in production.

```
┌───────────────┐         ┌──────────────────────────┐
│  App container │ ──────▶ │  External Postgres        │
│  (this image)  │  TCP    │  (managed / dedicated)    │
└───────────────┘         └──────────────────────────┘
        ▲
        │ env (DATABASE_URL, secrets, …)
```

## What the image does on boot

The entrypoint (`src/server/entrypoint.ts`) runs, in order, on **every** start:

1. **Validate env** (`parseConfig`) — fail fast on missing/invalid values _before_ any DB work.
2. Acquire a **Postgres advisory lock** (on a dedicated connection) so concurrent replica starts don't double-migrate.
3. **Apply migrations** (`drizzle-orm` migrator — the only migration path; better-auth's own `migrate` is never run).
4. **Seed the first admin** from `ADMIN_EMAIL`/`ADMIN_PASSWORD` — only if the `user` table is empty; strength-validates; sets `mustChangePassword`. Clear those env vars after first boot.
5. Release the lock and start the standalone Next.js server.

Because it connects to whatever `DATABASE_URL` points at, the same image is used across environments — only the env differs.

## Required environment

| Var                              | Required                     | Notes                                                                           |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | **yes**                      | Your external Postgres, e.g. `postgres://user:pass@db.host:5432/dbname`         |
| `BETTER_AUTH_SECRET`             | **yes**                      | ≥32 chars — `openssl rand -base64 32`                                           |
| `PUBLIC_BASE_URL`                | **yes**                      | Public base URL of this deployment (auth cookies/reset links, server-side tRPC) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first boot only              | Bootstrap admin; strength-checked; **clear after first boot**                   |
| `ALLOWED_IFRAME_ORIGINS`         | when embedded solutions ship | Comma-separated origins for CSP `frame-src`                                     |

> The Genie chat streaming endpoint is **not** an env var — each Chat solution configures its own (`config.apiEndpoint`, validated `https` + SSRF-guarded; default `https://dev-genie.001.gs/public-api/v2/workflow/chatbot/chats`).

Secrets are supplied via env **only** — never baked into the image.

## Running the app image against an external DB

`docker-compose.app.yml` runs **only the app** and points it at the `DATABASE_URL` you supply (no `db` service):

```bash
# .env (your real prod values)
DATABASE_URL=postgres://...your-external-postgres...
BETTER_AUTH_SECRET=...
PUBLIC_BASE_URL=https://workspace.example.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=...           # first boot only

docker compose -f docker-compose.app.yml up -d --build
```

You can equally run the image directly (k8s, Nomad, systemd, ECS…):

```bash
docker build -t genie-workspace .
docker run -d --name genie-app -p 80:3000 \
  --env-file .env.prod genie-workspace
```

## The Postgres you connect to

Provision and tune it as you would any production database — connection pooling (PgBouncer or the managed service's pooler), backups, monitoring, sufficient CPU/IOPS for the workload. The app's Drizzle `Pool` reads `DATABASE_URL`; size the pool to the platform (the entrypoint uses a short-lived dedicated connection for migrate/bootstrap only).

## What the other compose files are for

| File                      | Purpose                                                                | Runs Postgres?      |
| ------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `docker-compose.app.yml`  | **Production-shape**: app image against your external DB               | **No** (external)   |
| `docker-compose.dev.yml`  | **Local dev**: Postgres container only; you run `pnpm dev` on the host | Yes (dev throwaway) |
| `docker-compose.full.yml` | **All-in-one smoke / fresh-deploy test**: app + Postgres               | Yes (ephemeral)     |

`full.yml` exists purely to test the whole boot sequence (build → migrate → seed → serve) in one command — it is **not** the production topology.
