# Production deployment

**Topology: the app and database run separately.** Coolify manages an app container and a PostgreSQL container on the same Tencent Lighthouse server. PostgreSQL needs persistent storage and a private network connection from the app. A managed or dedicated PostgreSQL server is also supported through `DATABASE_URL`.

The selected public URL is `https://opscenter.agilgenie.ai`. Resources were provisioned on 2026-09-10. The app is healthy through both Cloudflare and the origin proxy. Tencent Lighthouse permits inbound TCP 443 for HTTPS. Off-server backup storage still needs to be selected before retaining real production data.

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

Both app Compose services inherit the image's health check. On the installed Coolify 4.3.18, leave its generated HTTP health-check override disabled (`health_check_enabled=false`). Coolify then detects the Dockerfile check (`custom_healthcheck_found=true`) and uses the image's Node command. Enabling the HTTP override before detection replaced it with a failing curl/wget probe in the first deployment. Verify the actual container's `Config.Healthcheck`, rather than relying on the UI toggle alone. Coolify waits through the configured startup period before finishing the deployment, even if Docker reports healthy sooner. Docker health status alone does not automatically restart an unhealthy running container.

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

## Current Coolify deployment

The tc1 proxy runs `traefik:v3.7.13` (upgraded on 2026-09-10 after reviewing the [3.7 migration guide](https://doc.traefik.io/traefik/v3.7/migrate/v3/)). Coolify retains the proxy configuration and its backups under `/data/coolify/proxy/` on tc1. The upgrade preserved the existing certificate storage, routing and Cloudflare trust settings; public HTTPS, direct-origin HTTPS, login and HTTP redirects were verified afterward.

Build the repository Dockerfile and route the app's internal port **3000** at `https://opscenter.agilgenie.ai`. PostgreSQL 16 runs as a separate Coolify resource on the same Lighthouse server, with a persistent volume and a private network reachable from the app. Set `DATABASE_URL` to that service's internal hostname, database and credentials. `localhost` inside the app container points to the app itself.

Set runtime environment variables in Coolify. Node is supplied by the `node:24-bookworm-slim` image; the Lighthouse host does not need Node or nvm. The image tag tracks Node 24 rather than pinning a patch or digest. Keep `BETTER_AUTH_SECRET` stable across redeploys, and remove bootstrap credentials after the initial admin is created.

Cloudflare DNS proxies `opscenter.agilgenie.ai` to Lighthouse `129.226.214.125`. Traefik on Lighthouse terminates HTTPS and routes to the app; the local Coolify VM at `192.168.50.24:8000` only manages deployment over SSH. Both public and direct-origin HTTPS passed normal TLS validation. The Cloudflare Full (strict) dashboard setting has not been inspected. Both Traefik and Better Auth are configured with Cloudflare's published proxy ranges; client-IP extraction is verified by the deployment smoke check. A database dump restored successfully into a separate temporary database, which was then removed. Scheduled off-server backups remain pending (`genie-ops-center-n3r`); persistent storage does not protect against loss of the server.

The resources are in **Genie Workspace → production → tc1**:

| Resource | Coolify UUID / container name |
| --- | --- |
| App: Genie Workspace | `crxh0klwfrwzv1snoglbblew` |
| Database: genie-postgres | `ihtijyutvwtxkxvxeg6vgh6p` |
| Database volume | `postgres-data-ihtijyutvwtxkxvxeg6vgh6p` |

The private GitHub repository uses a dedicated read-only deploy key. Deploy `main` from Coolify; automatic GitHub deployments are not configured. Production starts with one administrator and no demo solutions or chats. Bootstrap settings were cleared after creating the administrator; first login requires a password change. Resend uses `Genie Workspace <noreply@agilgenie.ai>` on the verified domain; actual invitation/reset delivery still needs a recipient-approved test.

Remote PostgreSQL administration was verified through an [SSH tunnel](https://www.postgresql.org/docs/current/ssh-tunnels.html). Run this locally and keep the terminal open:

```bash
db_ip=$(ssh -n root@129.226.214.125 "docker inspect ihtijyutvwtxkxvxeg6vgh6p --format '{{(index .NetworkSettings.Networks \"coolify\").IPAddress}}'")
ssh -o ExitOnForwardFailure=yes -N -L "127.0.0.1:15432:${db_ip}:5432" root@129.226.214.125
```

Connect your database client to `127.0.0.1:15432`, database `genie`, user `genie`, using the database password shown in Coolify. The SSH transport encrypts the remote connection; PostgreSQL has no public host port. Resolve the container IP each time because it may change when Coolify recreates the container. Stop the tunnel with Ctrl+C.

## The Postgres you connect to

The app uses a `pg.Pool` with library defaults; there is no pool-size environment setting in this repo. The container entrypoint holds a session-level advisory lock on a dedicated database connection while migrations and bootstrap run. Use a direct database connection or a session-preserving pooler for startup; a transaction-mode pooler does not preserve that lock. Plan backups, monitoring and capacity for the workload. The repository does not provision or schedule backups.

## What the other compose files are for

| File                      | Purpose                                                                | Runs Postgres?      |
| ------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `docker-compose.local.yml` | **Local dev**: Postgres plus an optional first-run bootstrap service; you run `pnpm dev` on the host | Yes (persistent local volume) |
| `docker-compose.smoke.yml` | **All-in-one smoke / fresh-deploy test**: app + Postgres               | Yes (persistent test volume) |

`smoke.yml` tests the whole boot sequence (build → migrate → seed → serve) in one command. Production PostgreSQL is provisioned separately in Coolify, with its own storage and backup configuration.

Both Compose files retain their named volumes after `down`; `down -v` removes the volume and its data. The local Compose publishes PostgreSQL on the host, while the smoke Compose keeps it on the internal network. Neither file is the Coolify production resource definition.
