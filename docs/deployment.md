# Production deployment

**Topology: the app and database run separately.** For the first deployment, Coolify will manage an app container and a PostgreSQL container on the same Tencent Lighthouse server. PostgreSQL needs persistent storage and a private network connection from the app. A managed or dedicated PostgreSQL server is also supported through `DATABASE_URL`.

The selected public URL is `https://work.agilgenie.ai`. This describes the planned deployment; the production resources are not yet provisioned. Off-server backup storage still needs to be selected before retaining real production data.

```
┌───────────────┐         ┌──────────────────────────┐
│  App container │ ──────▶ │  PostgreSQL container     │
│  (this image)  │  TCP    │  (persistent storage)     │
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

## Container health

The Dockerfile checks `/api/health` over loopback using Node, so the runner needs no curl or wget. The endpoint returns HTTP 200 only after a successful database query; errors return 503. Redirects, other status codes, connection failures and probes exceeding five seconds fail the check.

Checks run every 10 seconds, with six consecutive failures marking the container unhealthy. The 180-second startup grace period allows for the entrypoint's default 120-second migration-lock wait and migration/bootstrap work. A successful probe makes the container healthy immediately; it does not have to wait out the grace period. Reassess this allowance if migration duration or `LOCK_TIMEOUT_MS` increases.

Both app Compose services inherit the image's health check. In Coolify, deploy with the Dockerfile build pack and enable health checks; the [Dockerfile check takes precedence over the UI probe](https://coolify.io/docs/knowledge-base/health-checks). Verify the deployed container becomes healthy and the proxy routes to it. Docker health status alone does not automatically restart an unhealthy running container.

## Required environment

| Var                              | Required                     | Notes                                                                           |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | **yes**                      | Your external Postgres, e.g. `postgres://user:pass@db.host:5432/dbname`         |
| `BETTER_AUTH_SECRET`             | **yes**                      | ≥32 chars — `openssl rand -base64 32`                                           |
| `PUBLIC_BASE_URL`                | **yes**                      | Public base URL of this deployment (auth cookies/reset links, server-side tRPC) |
| `RESEND_API_KEY`                 | when invite/reset email ships | Resend API key for invite/reset delivery; without it, production invite/reset is refused |
| `RESEND_FROM_EMAIL`              | optional                     | Defaults to `onboarding@resend.dev` for testing; switch to a verified domain before go-live |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first boot only              | Bootstrap admin; strength-checked; **clear after first boot**                   |
| `GENIE_CHAT_API_ALLOWED_ORIGINS` | when chat solutions ship     | Comma-separated approved origins for chat streaming endpoints, e.g. `https://dev-genie.001.gs`. A Chat solution's `apiEndpoint` origin must be on this list. |
| `ALLOWED_IFRAME_ORIGINS`         | when embedded solutions ship | Comma-separated origins for CSP `frame-src`                                     |

> The chat streaming endpoint is **per-solution** config (`config.apiEndpoint`), not a single env base — but its origin must be on `GENIE_CHAT_API_ALLOWED_ORIGINS` (the SSRF allow-list, default-seed, and rotation point).

Secrets are supplied via env **only** — never baked into the image.

## Running the app image against an external DB

`docker-compose.app.yml` runs **only the app** and points it at the `DATABASE_URL` you supply (no `db` service):

```bash
# .env (your real prod values)
DATABASE_URL=postgres://...your-external-postgres...
BETTER_AUTH_SECRET=...
PUBLIC_BASE_URL=https://workspace.example.com
RESEND_API_KEY=...
RESEND_FROM_EMAIL=onboarding@resend.dev
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

`full.yml` tests the whole boot sequence (build → migrate → seed → serve) in one command. Production PostgreSQL is provisioned separately in Coolify, with its own storage and backup configuration.
