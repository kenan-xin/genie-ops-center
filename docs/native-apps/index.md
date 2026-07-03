# Native apps — isolation & add/remove guide

A **native app** is a first-party application built inside this repo (e.g. *Community Manager*, *News Verification*) that customers open through the normal solution viewer at `/s/[slug]`. Native apps are designed to be **self-contained and cleanly removable** — code *and* data — so you can add or retire one without touching core.

> **Status:** this documents the native-apps foundation defined in [tech-plan/native-solutions](../tech-plan/native-solutions/index.md) (ticket 24) and its prerequisite [tech-plan/platform-identity](../tech-plan/platform-identity/index.md) (ticket 25). It becomes operational when those ship. Design decisions and rationale live in those plans; this file is the how-to.

## How isolation works

**The one rule that makes everything else work:**

> Imports flow **one way**: `native → core/kit` only. **Core code must never import from `src/native/`.**

The only inbound references to a native app are three thin barrels that reference apps *by key* or *lazy import* — never a hard import into core. So deleting an app directory can't strand a reference in core; the compiler points you at the one barrel line to remove, and nothing else breaks. (This is exactly the coupling the old reference app got wrong, when core `applications` imported a native app's component.)

Three dimensions of isolation:

| Dimension | Mechanism |
| --- | --- |
| **Code** | Everything for an app lives under `src/native/<app>/`. Core imports it only lazily, by key, through the barrels. |
| **Data** | Each app's tables live in their **own Postgres schema** — `pgSchema("na_<app>")` — declared in the app's own `schema.ts`. Never in core's `schema.ts`. Removed with `DROP SCHEMA na_<app> CASCADE`; core's `public` schema is untouched. |
| **Server** | Each app's tRPC procedures live in its own `server/router.ts`, merged under one `native` key. Removing the app removes its router with one barrel line. |

A native app **may** freely use the shared UI kit (`@/components/ui/*`), shared components, and the design tokens — the dependency is one-directional.

## Directory anatomy

```
src/native/
  registry.ts          # CLIENT: key → { component: lazy(() => import("./<app>/surface")) }
  manifest.ts          # ISOMORPHIC data: [{ key, slug, name, monogram, status }] — the sync seed
  server/routers.ts    # merges every per-app router under ONE `native` tRPC key
  <app>/               # ← ONE self-contained, removable app
    surface.tsx        # "use client" entry the registry lazy-loads; owns its internal routing
    components/        # app-only UI (may import @/components/ui + shared kit)
    server/router.ts   # app's own tRPC router (client surface → server data)  [optional]
    schema.ts          # app's own tables in pgSchema("na_<app>")               [only if it needs a DB]
```

- `registry.ts` (client) holds the `React.lazy` component refs — imported by the viewer's client host.
- `manifest.ts` is **plain data with no React**, so the Node sync script can import it without dragging a client module into Node.
- The app surface is a client component and does its own internal routing off the catch-all `/s/[slug]/[[...rest]]` path (deep links work).

## Adding a native app

1. **Scaffold the directory** `src/native/<app>/`:
   - `surface.tsx` — a `"use client"` component. It receives `{ solution, rest }` (the sub-path segments) and renders the app, routing internally.
   - `components/` — any app-only UI (import `@/components/ui/*` and shared kit as needed).
2. **(If it needs data) add `src/native/<app>/schema.ts`:**
   ```ts
   import { pgSchema } from "drizzle-orm/pg-core";
   export const na = pgSchema("na_<app>");
   export const myTable = na.table("my_table", { /* columns */ });
   ```
   Query it from the app's router via direct table refs on the shared `db` — do **not** register it in `src/server/db/index.ts`.
3. **(If it needs server logic) add `src/native/<app>/server/router.ts`** exporting a tRPC router, and register it in `src/native/server/routers.ts` (one line under the `native` key).
4. **Register the surface** in `src/native/registry.ts` (one line):
   ```ts
   "<app>": { component: lazy(() => import("./<app>/surface")) },
   ```
5. **Add the seed entry** in `src/native/manifest.ts` (one line): `{ key: "<app>", slug, name, monogram, status: "ready" }`. The `key` must match the registry key and becomes the solution's `config.routeKey`.
6. **Generate the migration:** `pnpm db:generate` (drizzle-kit's glob picks up the new `schema.ts`), review, commit.
7. **Seed the solution row:** run `sync-native-solutions.ts`. It upserts the `solution` row (type `native`) and, on first creation, grants it to the **Everyone** group so all users can reach it. Admins can later re-scope it to specific groups from the Access screen.

The app is now reachable at `/s/<slug>`, appears in the hub (and recents/favorites), and is grantable per-group like any other solution.

## Removing a native app

1. `rm -rf src/native/<app>/`
2. Delete the app's **one line** in each barrel: `registry.ts`, `manifest.ts`, and (if present) `server/routers.ts`.
3. `pnpm db:generate` → drizzle emits `DROP … CASCADE` for `na_<app>` (tables **and their data**); review + commit the migration.
4. Re-run `sync-native-solutions.ts` to drop the app's `solution` row and grants.
5. `pnpm tsc` — the one-way-import invariant guarantees the only breakages are the barrel lines you already removed. If `tsc` is green, the app is fully gone and core is untouched.

## Rules of thumb

- **Never** `import … from "@/native/…"` in core (`src/app`, `src/features`, `src/server`, `src/components`). If you need to, that's a sign shared code belongs in the kit, not in an app.
- **Never** put a native app's tables in core `src/server/db/schema.ts` — always its own `pgSchema("na_<app>")`.
- Keep the `registry` key, the `manifest` key, and the solution's `config.routeKey` identical — the sync script warns on drift.
- Native apps ride the **same access model** as every solution: reachable only through group grants, gated by the see/run guards. No per-app auth.

## Related

- [tech-plan/native-solutions](../tech-plan/native-solutions/index.md) — architecture, DB isolation, viewer wiring, sync script (ticket 24).
- [tech-plan/platform-identity](../tech-plan/platform-identity/index.md) — the Everyone group + protected admin these depend on (ticket 25).
