---
kind: ticket
title: "01 · Scaffold & infra"
status: 2
---

# 01 · Scaffold & infra

Stand up a deployable, empty Next.js app with the full toolchain wired.

## Scope — in

- Next.js 16 (app router) + TypeScript; route-group skeleton `(auth)` / `(workspace)` / `(admin)` with placeholder pages and base layout/providers.
- shadcn **on Base UI** (not Radix) + Tailwind; import the **Ledger design tokens** (`design-package/design-system/tokens/*` → Geist/Geist Mono, colors, spacing, type scale) as the global stylesheet; light/dark toggle.
- tRPC server + `/api/trpc` route + `@trpc/tanstack-react-query` client provider; server-side tRPC caller for RSC; zod set up.
- Drizzle client + `drizzle-kit` config + Postgres connection from `DATABASE_URL`; `next.config` `output: 'standalone'` set for later containerization.
- **Client-state & forms libs**: **zustand** (with the `devtools` middleware for dev), **`@tanstack/react-query-devtools`** (`ReactQueryDevtools` wired into the client provider, dev-only), **react-hook-form** + **`@hookform/resolvers`**. Conventions in the [plan](../../tech-plan/index.md) (Client state & forms).
- **Lint / format + git hooks**: **oxlint** (lint) + **oxfmt** (format) configured; a lightweight **pre-commit hook** (e.g. `simple-git-hooks` or husky + lint-staged) runs `oxfmt` then `oxlint` on staged files and **blocks the commit on lint errors**. `.gitignore` for Next/node. _(Repo already initialized on `main` with `origin = git@github.com:kenan-xin/genie-ops-center.git`.)_

## Scope — out

- Any schema tables, auth, or domain features (later tickets). No better-auth yet.
- **Docker image, entrypoint, runtime config** — moved to [03b · Docker image & runtime config](../03b-docker-runtime/index.md).

## Governs

[tech-plan](../../tech-plan/index.md) (Architectural approach, Operational), [design-package](../../design-package/index.md).

## Depends on

None (first ticket).

## Acceptance / guardrails

- `next build` runs clean; the app serves the Ledger shell in dev (containerization is [03b](../03b-docker-runtime/index.md)).
- A staged change with a lint error is **blocked by the pre-commit hook**; `oxlint` and `oxfmt` run clean on the scaffold.
- **No hard-coded px font sizes** — all type via Ledger tokens. Brand blue only for primary/selection.
- tRPC roundtrip works from both an RSC server caller and a client hook.
