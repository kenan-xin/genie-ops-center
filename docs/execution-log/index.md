---
kind: spec
title: "Execution Log — accepted deviations"
---

# Execution Log — accepted deviations

Brief record of technically-sound deviations accepted during execution (technical lens). Product-level decisions are unchanged.

## Ticket 01 · Scaffold & infra — Well Implemented

Verified: scope boundaries clean (no Docker/better-auth/schema/component-kit), Ledger tokens wired, `output: 'standalone'`, pre-commit hook installed + runs lint-staged, `oxlint`/`tsc` clean.

Accepted deviations:

- **Fonts via `next/font/google`** (self-hosted Geist/Geist Mono) instead of Ledger `fonts.css` Google-Fonts `@import`; Ledger `--font-*` vars rewired to the next/font vars. Same fonts, faster, no runtime @import. Ledger px token values kept as source-of-truth; no UI hard-codes px.
- **Dark mode on `[data-theme="dark"]`** (Ledger's strategy) via next-themes `attribute="data-theme"`; shadcn's `.dark` class strategy dropped to match.
- **oxfmt 0.57.0 used** (no Prettier substitution) — runs clean, defaults match house style.
- **node-postgres (`pg`) Pool** driver; **next-themes** theming; **no tRPC superjson transformer yet** (plain JSON; add when a procedure needs Date/Map).

Carry-forward (for later tickets):

- **Ticket 02:** re-skin the vendored shadcn `button` (currently default `text-sm`/rem sizing) to Ledger tokens.
- **Ticket 03b (Docker):** build stage should `pnpm install --frozen-lockfile` (no `.git` in the build context; `prepare` is guarded `simple-git-hooks || true`; package manager is **pnpm**, pinned via `packageManager`). sharp postinstall deferred by npm allow-scripts → image-opt is a runtime concern.
- **Env limitation:** no headless Chrome/display, so real-browser DOM checks aren't possible here; client behavior verified via the exact HTTP transport + typed build instead.

## Ticket 02 · Ledger component kit — Well Implemented

Verified: 17 components present; scope clean (no AI Elements/auth/schema/Docker; kitchen-sink preview removed); addendum wired (zustand, `ReactQueryDevtools` dev-gated, react-hook-form + resolvers, AGENTS.md conventions); no hard-coded font px (px present are dimensions/spacing per Ledger recipes); `oxlint`/`tsc` clean.

Accepted deviations:

- Button re-skin resolved the ticket-01 carry-forward (cva → 5 Ledger variants, `rounded-none`, type via `--t-*` utilities added to `@theme inline`).
- **SlideOver built on Base UI `Dialog`** (right-edge) rather than the heavier `Drawer` primitive.
- RHF binding: `Input` native via `register`; `Select`/`Switch` via a documented `Controller` pattern (in `AGENTS.md`).
- Skeleton uses `animate-pulse` (reduced-motion-safe) vs a bespoke shimmer; `Label` carries a scoped a11y disable (standalone primitive); `Spinner` uses `<output>`.
- Editor-only Next TS-plugin hint (71007) on `TransferList` `onChange` — benign; gates clean.

## Ticket 03 · Identity + schema + migrations — Well Implemented

Verified against the critique invariants (agent ran a real DB-backed smoke test against Postgres, all 6 invariant groups passing): all key files present; `expiresIn=FIFTEEN_MINUTES` + `updateAge:0` (true sliding idle) + `cookieCache` off; `adminRoles:["admin"]` multi-role; custom `status` + `mustChangePassword`; `pending` blocked at `session.create.before` (`return u?.status !== "pending"`); `mustChangePassword` enforced at the shared accessor returning `"password-change-required"`; status derived not dual-written; drizzle-kit sole migration owner (no better-auth `migrate`); `oxlint`/`tsc`/`next build` clean.

Accepted deviations / notes:

- **Invite path = reset-link (primary),** verified working for an admin-created unverified user with a generated password; the `adminSetPassword` fallback is implemented in the domain service as the named safety net, not the chosen path.
- **CLI quirk:** `@better-auth/cli generate` can't resolve `server-only`; the agent stripped the `server-only` imports during generation and restored them after. Auth tables are committed (not regenerated at runtime) → one-time authoring step. **Ticket 03b** should `pnpm install --frozen-lockfile` in the Docker build (no `.git`/hooks) and document this.
- `sendResetPassword` logs the link (no email transport in foundation — email/ops is a later slice).
- `updateAge:0` chosen over `disableSessionRefresh` for true sliding idle (verified effective).
- The committed `scripts/smoke-identity.ts` is the invariant test; it needs `tsx` (currently transitive) — consider `pnpm add -D tsx` + a `db:smoke` script.
- **Deferred:** full idle-window timing test across the HTTP surfaces (RSC/tRPC/`/api/chat`) — the accessor is shared so it's a test-harness gap, not an enforcement gap; real email delivery; the `/api/chat` route + admin UI (later tickets).

## Ticket 03b · Docker image & runtime config — Well Implemented

Verified end-to-end: `docker compose up --build` against a **fresh volume** ran the full boot sequence — `parseConfig()` fail-fast → advisory lock → `drizzle-orm migrate` → `bootstrapAdmin` (seeded `admin@example.com` with `mustChangePassword`) → lock released → standalone server → `GET /` = HTTP 200, `/api/health` = `{"status":"ok"}`. `node:24` base, pnpm via Corepack, `--frozen-lockfile --ignore-scripts`, non-root runtime user, secrets via env only.

Accepted deviations / notes:

- **Entrypoint correctness:** the agent held a **dedicated `PoolClient`** for the whole sequence and ran migrate + bootstrap on the _same_ client under a **session-level** `pg_try_advisory_lock` (polled with timeout) — the right fix for the subtle "lock must bind to the backend that runs the DDL" issue; a transaction or pooled connection would have let the lock slip.
- **Entrypoint is esbuild-bundled** (`pnpm build:entrypoint`) and run with `node --conditions react-server` so the `server-only` marker resolves; migrations run via `drizzle-orm/node-postgres/migrator` (no drizzle-kit CLI in the image).
- **Two compose files (intentional):** `docker-compose.yml` (app image + db, prod-shaped) and `docker-compose.dev.yml` (db only, for `pnpm dev` on the host) — added during the pnpm switch. Both use the same `DATABASE_URL` contract.
- `next build` needs env present for page-data collection; the Dockerfile uses throwaway **placeholders** (verified standalone reads `process.env` at runtime — secrets not baked).
- **Env limitation persists:** no headless browser, so real-browser DOM checks still can't run here.
