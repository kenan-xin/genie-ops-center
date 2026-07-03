---
kind: ticket
title: "24b · Native viewer runtime"
status: 0
---

# 24b · Native viewer runtime

Makes a registered native app openable through the viewer at `/s/[slug]`, with URL-addressable internal sub-routes.

Governs: [tech-plan/native-solutions](../../../tech-plan/native-solutions/index.md).

## Scope — in

- `nativeConfigSchema` (`solution.ts:74`) → `z.object({ routeKey: z.string().min(1) }).strict()`.
- `resolve.ts`: add the `{ kind: "native-route"; routeKey; solution }` union member; replace the current `not-openable` native branch (`:115-116`) with parse-config → `assertCanRun` (status = ready) → `native-route`; an unknown `routeKey` → `not-openable`.
- **Route** → optional catch-all `s/[slug]/[[...rest]]`; `slug` drives the single access gate, `rest` is passed to the surface for client-side internal routing.
- **`NativeSurfaceHost`** (client): registry lookup + lazy component in `<Suspense>`; unknown key → `NotOpenableNotice`.
- `recordRecent` fires **once on the base open**, not per internal sub-path.
- The example app's `surface.tsx` renders end-to-end (mounted + internally routed).

## Scope — out

- Catalogue visibility / hub filter / sync / admin (24c).

## Depends on

- [24a · Module + DB isolation](../24a-module-db-isolation/index.md) (registry + example app), [12 · Viewer shell](../../12-solution-viewer-embedded/index.md) (the `ViewerSurface` union this extends).

## Acceptance / guardrails (critique findings)

- **F5 — catch-all consumers fixed:** `pinned-favorites.tsx:95` exact → prefix match (`=== /s/${slug} || startsWith(/s/${slug}/)`); `workspace-chrome.tsx:50-53` reset re-keyed on a derived **route-root** so internal native nav doesn't wipe drawer/sidebar state; `workspace-header.tsx:20` (`startsWith`) unaffected.
- Native inherits the see/run lifecycle: draft → 404, maintenance/down → status notice, archived/no-grant → 404/403.
- An unknown/unregistered `routeKey` never crashes and never leaks existence.
