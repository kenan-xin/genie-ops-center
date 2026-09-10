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
| `DATABASE_URL`                   | **yes**                      | Separate PostgreSQL service, e.g. `postgres://user:pass@db.host:5432/dbname`         |
| `BETTER_AUTH_SECRET`             | **yes**                      | ≥32 chars — `openssl rand -base64 32`                                           |
| `PUBLIC_BASE_URL`                | **yes**                      | Public base URL of this deployment (auth cookies/reset links, server-side tRPC) |
| `AUTH_TRUSTED_PROXIES`           | behind multiple proxies      | Comma-separated trusted proxy IPs/CIDRs for Better Auth's `X-Forwarded-For` parsing; empty by default. For Cloudflare + Traefik, use Cloudflare's published ranges and configure the same `forwardedHeaders.trustedIPs` on Traefik's HTTP/HTTPS entrypoints. Never trust all addresses. |
| `RESEND_API_KEY`                 | when invite/reset email ships | Needed for actual delivery. Admin service invite/reset actions reject missing configuration in production; the public forgot-password path can still report generic success without delivery. |
| `RESEND_FROM_EMAIL`              | optional                     | Defaults to `onboarding@resend.dev`, which is restricted to the Resend account owner. Use a sender on a verified domain for other recipients. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first boot only              | Bootstrap admin; strength-checked; **clear after first boot**                   |
| `GENIE_CHAT_API_ALLOWED_ORIGINS` | for chat solutions     | Comma-separated approved origins for chat streaming endpoints, e.g. `https://dev-genie.001.gs`. A Chat solution's `apiEndpoint` origin must be on this list. |
| `ALLOWED_IFRAME_ORIGINS`         | for embedded solutions | Comma-separated origins added to CSP `frame-src`; `self` remains allowed                                     |

> The chat streaming endpoint is **per-solution** config (`config.apiEndpoint`), not a single env base — but its origin must be on `GENIE_CHAT_API_ALLOWED_ORIGINS` (the SSRF allow-list, default-seed, and rotation point).

Secrets are supplied via env **only** — never baked into the image.

The [Resend test sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) applies even with a valid API key. A configured API key is not proof of successful email delivery. Better Auth can log provider failures while the initiating request reports success. Verify invite/reset delivery with the intended sender before onboarding users; failure visibility is tracked in Beads (`genie-ops-center-xu6`).

## Planned Coolify deployment

Build the repository Dockerfile and route the app's internal port **3000** at `https://work.agilgenie.ai`. PostgreSQL 16 will run as a separate Coolify resource on the same Lighthouse server, with a persistent volume and a private network reachable from the app. Set `DATABASE_URL` to that service's internal hostname, database and credentials. `localhost` inside the app container points to the app itself.

Set runtime environment variables in Coolify. Node is supplied by the `node:24-bookworm-slim` image; the Lighthouse host does not need Node or nvm. The image tag tracks Node 24 rather than pinning a patch or digest. Keep `BETTER_AUTH_SECRET` stable across redeploys, and remove bootstrap credentials after the initial admin is created.

Cloudflare DNS resolves to proxy addresses, so public DNS alone does not verify the configured Lighthouse origin. Origin routing and HTTPS still need deployment validation. Off-server backup storage and a restore test are also pending; a persistent volume survives container replacement but does not protect against loss of the server.

Remote PostgreSQL administration is planned through an [SSH tunnel](https://www.postgresql.org/docs/current/ssh-tunnels.html). It has not been configured. The tunnel must target a database address reachable from the Lighthouse SSH host, or a host-loopback-only published port; a private Docker service name is not necessarily resolvable by the host. Keep PostgreSQL off the public Internet. The exact connection settings depend on the Coolify resource that is created.

## Running the app image against a separate DB

`docker-compose.app.yml` runs **only the app** and points it at the `DATABASE_URL` you supply (no `db` service):

```bash
# .env (your real prod values)
DATABASE_URL=postgres://...your-external-postgres...
BETTER_AUTH_SECRET=...
PUBLIC_BASE_URL=https://work.agilgenie.ai
RESEND_API_KEY=...
RESEND_FROM_EMAIL=workspace@your-verified-domain.example
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=...           # first boot only

docker compose -f docker-compose.app.yml up -d --build
```

For a local image check against a database reachable from the container:

```bash
docker build -t genie-workspace .
docker run -d --name genie-app -p 127.0.0.1:3000:3000 \
  --env-file .env.prod genie-workspace
```

## The Postgres you connect to

The app uses a `pg.Pool` with library defaults; there is no pool-size environment setting in this repo. The container entrypoint holds a session-level advisory lock on a dedicated database connection while migrations and bootstrap run. Use a direct database connection or a session-preserving pooler for startup; a transaction-mode pooler does not preserve that lock. Plan backups, monitoring and capacity for the workload. The repository does not provision or schedule backups.

## What the other compose files are for

| File                      | Purpose                                                                | Runs Postgres?      |
| ------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `docker-compose.app.yml`  | **Production-shape**: app image against your external DB               | **No** (external)   |
| `docker-compose.dev.yml`  | **Local dev**: Postgres container only; you run `pnpm dev` on the host | Yes (persistent dev volume) |
| `docker-compose.full.yml` | **All-in-one smoke / fresh-deploy test**: app + Postgres               | Yes (persistent test volume)     |

`full.yml` tests the whole boot sequence (build → migrate → seed → serve) in one command. Production PostgreSQL is provisioned separately in Coolify, with its own storage and backup configuration.

Both database Compose files retain their named volumes after `down`; `down -v` removes the volume and its data. The dev Compose publishes PostgreSQL on the host, while the full smoke Compose keeps it on the internal network. Neither file is the planned Coolify production resource definition.
