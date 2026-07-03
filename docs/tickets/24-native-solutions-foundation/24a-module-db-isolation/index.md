---
kind: ticket
title: "24a · Native module system + DB isolation"
status: 0
---

# 24a · Native module system + DB isolation

The removable-module foundation: where native apps live, how they're wired through barrels, and how their data stays isolated. No user-facing change — proves the pattern with an example app scaffold.

Governs: [tech-plan/native-solutions](../../../tech-plan/native-solutions/index.md).

## Scope — in

- **Module layout** `src/native/<app>/` + the three barrels: `registry.ts` (client, key → `lazy(() => import("./<app>/surface"))`), `manifest.ts` (isomorphic seed data — no React), `server/routers.ts` (per-app routers merged under one `native` tRPC key).
- **DB isolation:** each app's tables in `pgSchema("na_<app>")` in its own `schema.ts`; `drizzle.config.ts` `schema` → glob `["./src/server/db/schema.ts", "./src/native/**/schema.ts"]`; native routers query via **direct table refs** on the shared `db` (no `db/index.ts` or better-auth-adapter change).
- **Example app scaffold** `src/native/example/`: a `schema.ts` (one table in `pgSchema("na_example")`) + `server/router.ts` reading it (its `surface.tsx` renders in 24b).
- **One-way-import guard:** oxlint `no-restricted-imports` forbidding `@/native/*` from outside `src/native/`.
- **CI/pre-commit guard:** `tsc` over native schemas + a `db:generate` check.

## Scope — out

- The viewer runtime + route (24b); the sync script + catalogue + admin (24c).

## Depends on

- [03 · Identity + schema + migrations](../../03-identity-schema-migrations/index.md) (drizzle client + the single linear migration history).

## Acceptance / guardrails (critique findings)

- **F4 — build-time coupling acknowledged:** the glob compiles all native schemas together, so a broken app schema fails `db:generate` **loudly, pre-deploy** (caught by the CI guard), never at runtime. Isolation here is a runtime + removability property, not a compile-time one.
- **F11:** the one-way rule is an **oxlint** rule (the repo uses oxlint, not ESLint).
- **F12:** registry entries use **literal** `import()` per key (not templated), so each app code-splits.
- **F13:** native tables use `db.select().from(...)`; the relational `db.query.*` API is unavailable for native tables by design — document this for app authors.
- **F14 — removal caveat:** `db:generate` emits `DROP TABLE … CASCADE` per table + a plain `DROP SCHEMA` (no CASCADE); any non-Drizzle-managed object under `na_<app>` needs manual cleanup before the drop applies.
- The one-way invariant holds: `tsc` is green with zero core→native imports.
