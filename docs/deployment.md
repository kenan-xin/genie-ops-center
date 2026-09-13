# Production deployment

**Topology: the app and database run separately.** Deploy the application container with a PostgreSQL service that has persistent storage and a private network connection from the app. A managed or dedicated PostgreSQL server is also supported through `DATABASE_URL`.

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

Both app Compose services inherit the image's health check. A deployment platform should use this Dockerfile health check rather than replace it with a generated HTTP probe. Verify the running container's `Config.Healthcheck`, rather than relying on a platform toggle alone. Docker health status alone does not automatically restart an unhealthy running container.

## Environment contract

`.env.example` is the copy-safe, complete template. Keep real values in your local `.env`, deployment-platform variables, or another secret manager; never commit them. The entrypoint validates the three required runtime values before connecting to PostgreSQL or starting Next.js.

Every deployment needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `PUBLIC_BASE_URL`. The sections below separate those startup blockers from conditional feature settings and optional runtime controls. Resend needs both `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` to send real invitation or password-reset messages; bootstrap credentials are needed only when automatically creating the very first administrator.

### Required app runtime values

Set all three for every deployment. The entrypoint fails before any database work if one is missing or invalid.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL used by migrations, Drizzle, and Better Auth. Inside Docker, `localhost` is the app container, never the database. |
| `BETTER_AUTH_SECRET` | Stable random value, at least 32 characters. Generate with `openssl rand -base64 32`; changing it invalidates active sessions. |
| `PUBLIC_BASE_URL` | Canonical HTTPS URL for auth cookies, reset links, and server-side tRPC. No trailing path. |

### Conditional feature configuration

Set these only when the described feature is needed.

| Variable | Configure it when | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | Sending invitation or password-reset emails | Required with `RESEND_FROM_EMAIL` for real email delivery. Production admin actions reject absent email configuration; host `pnpm dev` logs links when it is empty. |
| `RESEND_FROM_EMAIL` | Sending invitation or password-reset emails | Use a sender on a verified Resend domain for recipients beyond the account owner. |
| `ADMIN_EMAIL` | Bootstrapping the first administrator in an empty database | Has no effect after a user exists. |
| `ADMIN_PASSWORD` | Bootstrapping the first administrator in an empty database | Strong temporary password. It sets `mustChangePassword`; remove it after the first successful login. |
| `GENIE_CHAT_API_ALLOWED_ORIGINS` | Configuring chat solutions | Comma-separated HTTPS origins permitted for per-solution chat upstreams. Empty prevents chat solutions being saved or streamed. |

Embedded solutions need no environment setting: authorized administrators can configure any public HTTPS URL. An external app can still decline to render in an iframe through its own `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` response header.

### Optional app runtime controls

These have safe defaults and can normally be left unchanged.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` in the image | Use `development` for host `pnpm dev`. The Dockerfile fixes the container to `production`. |
| `PORT` | `3000` | Container listening port. If changed, update the reverse proxy's upstream port and the smoke Compose mapping. |
| `AUTH_TRUSTED_PROXIES` | empty | Comma-separated proxy IPs/CIDRs trusted for `X-Forwarded-For`. Add only published ranges of proxy services you operate. Never trust `0.0.0.0/0`. |
| `LOCK_TIMEOUT_MS` | `120000` | Maximum milliseconds a replica waits for the Postgres migration advisory lock. |

### Docker Compose helper variables

These configure only the repository's local helpers. Do **not** add them to a deployment platform unless a future Compose-based resource explicitly consumes them.

| Variable | Default | Used by | Notes |
| --- | --- | --- | --- |
| `POSTGRES_USER` | `genie` | local and smoke Postgres | Database role created on a new Compose volume. |
| `POSTGRES_PASSWORD` | `genie` | local and smoke Postgres | Development-only password. Changing it does not update an existing volume. |
| `POSTGRES_DB` | `genie` | local and smoke Postgres | Database created on a new Compose volume. |
| `POSTGRES_PORT` | `5432` | `docker-compose.local.yml` | Host port for local Postgres. Change when 5432 is occupied. |
| `APP_PORT` | `3000` | `docker-compose.smoke.yml` | Host port for the smoke-test app; it does not change the container's `PORT`. |

### Dockerfile build placeholders

The Dockerfile supplies build-only placeholders for `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` because `next build` evaluates server modules. They are not runtime configuration, are not copied into the standalone image as secrets, and must not be configured in the deployment platform. Both image stages set `NEXT_TELEMETRY_DISABLED=1`; the runner also fixes `NODE_ENV=production`, `PORT=3000`, and `HOSTNAME=0.0.0.0` unless you deliberately override `PORT` at runtime.

> The chat streaming endpoint is **per-solution** config (`config.apiEndpoint`), not a single env base — but its origin must be on `GENIE_CHAT_API_ALLOWED_ORIGINS` (the SSRF allow-list, default-seed, and rotation point).

Secrets are supplied via env **only** — never baked into the image.

## Optional Coolify guide

Coolify is one way to deploy this image; it is not a runtime dependency or repository requirement. The same image and environment contract work with any container platform.

1. Create separate `development` and `production` environments. Give each an application resource, private PostgreSQL service with persistent storage, independent secrets, and its own public hostname.
2. Create the app from the private Git repository. Use the read-only deploy key, the intended branch, the repository `Dockerfile`, base directory `/`, and internal port `3000`.
3. Add the public hostname with internal port `3000`. Create the required DNS record at your DNS provider, point it at the deployment host, and wait for DNS resolution before first deployment.
4. Add the runtime variables from the table above. Use a distinct `BETTER_AUTH_SECRET` per environment, the environment's database URL, and that hostname as `PUBLIC_BASE_URL`. Add Resend only when the environment needs to send real invitations or reset emails.
5. Set `ADMIN_EMAIL` and a strong temporary `ADMIN_PASSWORD` only for the first empty database. Deploy, verify `/api/health`, sign in, change the password, then delete `ADMIN_PASSWORD` from the platform variables.
6. Let Coolify use the Dockerfile health check. Do not enable its generated HTTP health-check override when it replaces the image check; confirm the app's Docker health check and public `/api/health` after deployment.
7. For branch-based promotion, configure the development app for `develop` and the production app for `main`, then enable **Deploy on push (webhooks)** on both. A single GitHub repository webhook can serve both apps, but its secret must match the GitHub webhook secret saved on each app. Pushes to `develop` deploy development; merging `develop` into `main` deploys production.

The [Resend test sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) applies even with a valid API key. A configured API key is not proof of successful email delivery. Better Auth can log provider failures while the initiating request reports success. Verify invite/reset delivery with the intended sender before onboarding users; failure visibility is tracked in Beads (`genie-ops-center-xu6`).

## Deploying on any platform

Build the repository Dockerfile and route a public HTTPS hostname to its internal port **3000**. Run PostgreSQL as a separate service with persistent storage and private connectivity to the app. Set `DATABASE_URL` to that service's hostname, database, and credentials; `localhost` inside the app container points to the app itself.

The host does not need Node or nvm because the image supplies `node:24-bookworm-slim`. Keep `BETTER_AUTH_SECRET` stable across redeploys, remove bootstrap credentials after the initial admin is created, and plan off-server backups before retaining production data.

### Accessing a private PostgreSQL service

Do not publish PostgreSQL port 5432 to the public internet. Use a private network, VPN, or an SSH tunnel through the deployment host. For example:

```bash
ssh -o ExitOnForwardFailure=yes -N \
  -L "127.0.0.1:15432:<private-db-address>:5432" \
  <ssh-user>@<deployment-host>
```

Connect a database client to `127.0.0.1:15432` using the database name, user, and password from the deployment platform. Resolve the database address by the platform's documented internal hostname rather than storing a transient container IP. Stop the tunnel with Ctrl+C.

## The Postgres you connect to

The app uses a `pg.Pool` with library defaults; there is no pool-size environment setting in this repo. The container entrypoint holds a session-level advisory lock on a dedicated database connection while migrations and bootstrap run. Use a direct database connection or a session-preserving pooler for startup; a transaction-mode pooler does not preserve that lock. Plan backups, monitoring and capacity for the workload. The repository does not provision or schedule backups.

## What the other compose files are for

| File                      | Purpose                                                                | Runs Postgres?      |
| ------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `docker-compose.local.yml` | **Local dev**: Postgres plus an optional first-run bootstrap service; you run `pnpm dev` on the host | Yes (persistent local volume) |
| `docker-compose.smoke.yml` | **All-in-one smoke / fresh-deploy test**: app + Postgres               | Yes (persistent test volume) |

`smoke.yml` tests the whole boot sequence (build → migrate → seed → serve) in one command. Production PostgreSQL is provisioned separately, with its own storage and backup configuration.

Both Compose files retain their named volumes after `down`; `down -v` removes the volume and its data. The local Compose publishes PostgreSQL on the host, while the smoke Compose keeps it on the internal network. Neither file defines the production database resource.
