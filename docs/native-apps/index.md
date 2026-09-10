# Native apps — planned isolation & add/remove guide

A **native app** is a first-party application built inside this repo (e.g. *Community Manager*, *News Verification*) that customers open through the normal solution viewer at `/s/[slug]`. Native apps are designed to be **self-contained and cleanly removable** — code *and* data — so you can add or retire one without touching core.

> **Not implemented:** `src/native/`, the catch-all native viewer, `sync-native-solutions.ts`, the Everyone group and protected-admin invariant do not exist in the current app. This is a future implementation guide for tickets 24/25, not a runnable setup procedure. The current viewer supports chat and embedded solutions. Use Beads for delivery status; the architecture and steps below describe the intended design.

## How isolation works

**The one rule that makes everything else work:**

> Imports flow **one way**: `native → core/kit` only. **Core code must never import from `src/native/`.**

The only inbound references to a native app are three thin barrels that reference apps *by key* or *lazy import* — never a hard import into core. So deleting an app directory can't strand a reference in core; the compiler points you at the one barrel line to remove, and nothing else breaks. (This is exactly the coupling the old reference app got wrong, when core `applications` imported a native app's component.)

Three dimensions of isolation:

| Dimension | Mechanism |
| --- | --- |
| **Code** | Everything for an app lives under `src/native/<app>/`. Core imports it only lazily, by key, through the barrels. |
| **Data** | Each app's tables live in their **own Postgres schema** — `pgSchema("na_<app>")` — declared in the app's own `schema.ts`. Never in core's `schema.ts`. Removal requires a reviewed migration that drops only the app-owned tables and schema; do not assume a generated schema drop includes `CASCADE`. |
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

## Planned addition procedure (after the foundation ships)

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

After implementing that foundation and applying its migrations, the app should be reachable at `/s/<slug>`, appears in the hub and favorites, and is grantable per-group like any other solution.

## Planned removal procedure (after the foundation ships)

1. `rm -rf src/native/<app>/`
2. Delete the app's **one line** in each barrel: `registry.ts`, `manifest.ts`, and (if present) `server/routers.ts`.
3. `pnpm db:generate`, then inspect and commit the destructive migration. Remove only the app-owned tables/schema; manually created objects can prevent a schema drop. Apply the migration through the normal deployment process after backing up data.
4. Re-run the planned `sync-native-solutions.ts` to **archive** its solution row. The design retains grants/favorites behind the archived filter; it does not delete the row or grants. Older plans also mention recents, but that workspace route has since been removed.
5. Run `pnpm typecheck` and the relevant tests; verify routing, catalogue reconciliation and the migration. A passing type check alone does not prove database cleanup or access behavior.

## Rules of thumb

- **Never** `import … from "@/native/…"` in core (`src/app`, `src/features`, `src/server`, `src/components`). If you need to, that's a sign shared code belongs in the kit, not in an app.
- **Never** put a native app's tables in core `src/server/db/schema.ts` — always its own `pgSchema("na_<app>")`.
- Keep the `registry` key, the `manifest` key, and the solution's `config.routeKey` identical — the sync script warns on drift.
- Native apps ride the **same access model** as every solution: reachable only through group grants, gated by the see/run guards. No per-app auth.

## Related

- [tech-plan/native-solutions](../tech-plan/native-solutions/index.md) — architecture, DB isolation, viewer wiring, sync script (ticket 24).
- [tech-plan/platform-identity](../tech-plan/platform-identity/index.md) — the Everyone group + protected admin these depend on (ticket 25).
