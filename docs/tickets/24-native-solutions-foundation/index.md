---
kind: ticket
title: "24 · Native solutions foundation (in-app Next.js routes)"
status: 0
---

# 24 · Native solutions foundation (in-app Next.js routes)

Resolves the ticket-11 / FR-HUB-03 "Native" gap by giving `native` a real runtime: each native solution maps to a **first-party bespoke Next.js surface**, registered in code and surfaced through the existing viewer.

> **Tech plan (2026-07-03):** the authoritative design is now [tech-plan/native-solutions](../../tech-plan/native-solutions/index.md). It refines this ticket — native apps are **self-contained, removable modules** under `src/native/<app>/` (one-way `native → core` imports; per-app `pgSchema("na_<app>")` for isolated, droppable data); surfaces are **client components** mounted via a catch-all `/s/[slug]/[[...rest]]` with URL-addressable sub-paths; default reach comes from the **Everyone group**. This adds a prerequisite: **ticket 25 · [Platform identity invariants](../../tech-plan/platform-identity/index.md)** (protected admin + always-all-users Everyone group), which ticket 24 depends on. Contributor how-to: [native-apps guide](../../native-apps/index.md).

## Origin

Ticket 11 audit (2026-07-02): the hub type filter omits "Native" (FR-HUB-03 lists All/Chat/Native/Embedded), and `native` is a documented non-goal in the tech-plan ("enum only, hidden, not openable"). Owner decision: **native solutions will exist, added from code** — bespoke in-app surfaces, not iframe/embedded and not admin-created. This ticket builds that foundation; the hub Native filter chip lands as the last step once native rows are real and un-hidden.

## Design decisions (owner-approved 2026-07-02)

1. **Native = custom in-app Next.js route per solution.** Each native solution renders a first-party bespoke UI inside the `/s/[slug]` shell (NOT an iframe, NOT external). Chosen over external-launch and coming-soon-placeholder options.
2. **Route coupling: registry pattern.** A native solution's `config` carries a `routeKey` (e.g. `"policy-library"`). A code registry maps `routeKey` → lazy React component. The viewer dispatches by key. One URL shape (`/s/[slug]`), access-gated uniformly through the existing `assertCanSee`/`assertCanRun` spine.
3. **Code-owned rows, no admin UI.** Native solution rows are upserted by a sync script from a typed manifest; the admin register UI stays `chat | embedded` (`solutionTypeSchema` unchanged). First-party surfaces ship as code; admins cannot create native solutions.

## Scope — in

- **`nativeConfigSchema` extension** (`src/features/solutions/schemas/solution.ts`): `{ routeKey: z.string().min(1) }` (currently `{}` empty). The `configByTypeSchema` native branch already exists.
- **Native route registry** (`src/features/solutions/native-registry.ts`): a typed `Record<string, NativeRouteSpec>` where `NativeRouteSpec = { component: React.LazyExoticComponent<...>; title?: string }`. Exports a `getNativeRoute(routeKey)` lookup. Shipped with **one example native surface** (e.g. a static first-party page) to prove the path end-to-end.
- **ViewerSurface variant** (`src/features/solution-viewer/server/resolve.ts`): add `{ kind: "native-route"; solution: ViewerSolutionMeta; routeKey: string }`. Replace the current `if (row.type === "native") return { kind: "not-openable" }` branch (lines 101-106) with: parse native config → return the native-route variant. An unknown `routeKey` (not in registry) collapses to `not-openable`.
- **Viewer page render** (`src/app/(workspace)/s/[slug]/page.tsx`): add a `surface.kind === "native-route"` branch that renders the registry-resolved component (lazy + `<Suspense>`).
- **`NotOpenableNotice`** → also covers unknown-native: keep it as the fallback for an unregistered `routeKey` (graceful degradation, no crash).
- **Catalogue un-hide:** remove the `` ${solution.type} <> 'native' `` SQL filter from `customerVisible` (`src/features/solutions-hub/server/queries.ts:53-58`) so granted native solutions appear. Update the comment. `assertCanSee` already intentionally doesn't exclude native (`src/server/features/solution-access.ts:72-76`) — direct visits already work.
- **Hub Native filter chip** (`src/features/solutions-hub/components/solutions-hub.tsx:33-37` + `schemas/hub.ts:8`): add `{ value: "native", label: "Native" }` to `TYPE_FILTERS` and widen `HubTypeFilter` to include `"native"`. Now meaningful because native rows exist.
- **Sync script** (`scripts/sync-native-solutions.ts`): idempotent upsert of native rows from a manifest (slug/name/monogram/description/routeKey/status), granted to a system group (e.g. "Everyone") so customers can reach them. Same direct-insert pattern as `scripts/seed-demo-solutions.ts`. Documented in `docs/deployment.md` run recipes.
- **Registry-vs-DB drift guard:** the sync script warns on native rows whose `routeKey` isn't in the registry (and vice versa), so a deployed row never silently hits not-openable.

## Scope — out

- Admin UI for creating/editing native solutions (explicitly excluded — code-owned).
- A runtime for arbitrary admin-authored native routes (can't ship code via UI).
- Migrating any existing chat/embedded solution to native.
- Per-native-route theming (native surfaces own their styling; themes are chat-only per ticket 09).

## Governs

- [tech-plan](../../tech-plan/index.md) (the `assertCanSee`/`assertCanRun` spine; native was the documented deferred runtime — this ticket delivers it).
- [data-model](../../tech-plan/data-model/index.md) (`solution.type` enum, `nativeConfigSchema`).

## Depends on

- [03 · Identity + schema](../03-identity-schema-migrations/index.md) (solution table).
- [12 · Viewer shell + status + embedded](../12-solution-viewer-embedded/index.md) (the ViewerSurface discriminated union this extends).
- [11 · Solutions hub](../11-solutions-hub/index.md) (`customerVisible` + filter this un-hides/widens).

## Acceptance / guardrails

- **Access invariant preserved (no new access code):** native surfaces are gated by the _same_ `assertCanSee`/`assertCanRun` spine as chat/embedded — group-grant + not-archived + not-draft + status=ready. `canSee`/`isGrantedSolution` are already native-agnostic (`src/server/features/solution-access.ts:69-86`) and intentionally do NOT exclude native; a native solution is reachable only through a user's group grants, identical to chat/embedded. A revoked/archived/draft native solution disappears from the hub and 404s on direct visit, same as the others. No per-route access re-implementation.
- **Permissions = group grants, same model:** there is no separate native permission system. Admins grant a native solution to a group from Access (the grants TransferList is type-agnostic once native rows exist); members reach it through the union query. The sync script's system-group grant is what makes a native solution customer-visible by default; revoking it pulls access immediately.
- **Stale-comment fix required:** the `solution-access.ts:72-76` comment says "native is never granted, so it can't reach recents/favorites anyway" — this becomes false once native is granted. Update the comment to reflect that native now rides the same recents/favorites cache as other types.
- **No existence leak:** unknown `routeKey` → not-openable notice, never a crash, never a stack trace.
- **No admin surface for native:** `solutionTypeSchema` stays `["chat", "embedded"]`; the register dialog and admin filter are unchanged. Native rows exist only via the sync script.
- **Registry is the only route source:** a native row's `routeKey` MUST resolve through the code registry; there is no DB-driven route injection.
- **One URL shape:** native surfaces live at `/s/[slug]` like everything else; no separate `/native/*` route tree with its own auth.
- **Sync script is idempotent and drift-aware:** re-runnable; warns on registry↔DB mismatch.

## Open questions (resolve at tech-plan, not here)

- Which first-party native surface ships as the example? (Placeholder acceptable for the foundation; the real surface is its own work.)
- Should native solutions participate in recents/favorites the same way? (Assume yes — they ride the same `HubSolution` projection — but confirm the UX of a "native" tile in the recents rail.)
