# Remove the redundant "Recent" workspace tab

**Date:** 2026-07-03
**Status:** Approved — ready for implementation plan
**Scope:** `src/app/(workspace)/` (nav, header, route), `src/features/solutions-hub/components/solution-list-page.tsx`
**No** database, schema, tRPC, or recents-backend changes.

## Problem

The non-admin workspace has a dedicated **Recent** nav tab (`/recent`) that duplicates
functionality already present in the Solutions hub. Recents are already "folded into" the hub:

1. **Default sort is "Recently opened"** — the hub's main catalogue opens most-recent-first
   (`HubPage` prefetches `solutionsHub.list({ sort: "recent" })`).
2. **A "RECENTLY OPENED" side rail** (`RecentRail` in `solutions-hub.tsx`) surfaces the 4 most-recent
   solutions — a persistent column at ≥1180px, stacked below the list on narrower screens.

The standalone `/recent` page (`SolutionListPage variant="recents"`) only shows up to 6 opened
solutions — a near-duplicate of the rail with no unique capability. It earns a top-level nav slot
it doesn't justify.

## Goals

- Remove the redundant `Recent` tab and its route.
- Preserve the recents experience entirely within the hub: the "RECENTLY OPENED" side rail, the
  recent-first default sort, and the recents backend.
- Leave `/favorites` and the shared list surface working.

## Non-goals

- No change to the recents **backend** (`solutionsHub.recents`, `useRecents`, open-recording via
  `s/[slug]`). The hub rail and recent-sort depend on it — it stays.
- No change to the hub's `RecentRail` ("RECENTLY OPENED" sidebar) — explicitly kept.
- No change to `/favorites` behavior.

## What is removed vs. kept

**Removed:**
- The `Recent` primary-nav item.
- The `/recent` route/page.
- The `/recent → "Recent"` page-title mapping in the workspace header.
- The now-dead `variant="recents"` path in the shared list component.

**Kept (untouched):**
- Solutions hub `RecentRail` ("RECENTLY OPENED"), recent-first default sort.
- Recents tRPC/query/recording backend.
- `/favorites` tab, route, and its use of the list surface.

## Changes

### 1. Drop the nav item — `src/app/(workspace)/_components/workspace-nav.tsx`

Remove the `{ href: "/recent", label: "Recent", exact: false }` entry from `ITEMS` (line 18). Nav
becomes: Solutions · Favorites · Account.

### 2. Delete the route — `src/app/(workspace)/recent/page.tsx`

Delete the file (and the now-empty `recent/` directory).

### 3. Drop the title mapping — `src/app/(workspace)/_components/workspace-header.tsx`

Remove the `if (pathname.startsWith("/recent")) return "Recent";` line (line 17). No `/recent` route
will exist to title.

### 4. Update the stale comment — `src/app/(workspace)/_components/workspace-chrome.tsx`

The doc comment at line ~22 lists the sidebar nav as "Solutions/Recent/Favorites/…" — update it to
drop "Recent" so the comment matches the nav.

### 5. Simplify the shared list surface — `src/features/solutions-hub/components/solution-list-page.tsx`

With `/recent` gone, `/favorites` is the only caller and the `variant="recents"` branch is dead.
Simplify:
- Drop the `variant` prop (and its `"recents" | "favorites"` union).
- Remove the `useRecents` import and the `variant === "recents" ? useRecents() : useFavorites()`
  ternary — call `useFavorites()` directly.
- Keep title/subtitle/empty as props (favorites still supplies them from its page).

This removes code this change orphans; it is not unrelated refactoring. `favorites/page.tsx` is
updated to drop the now-removed `variant="favorites"` prop.

## Verification

- `pnpm typecheck` and `pnpm lint` pass. In particular, confirm no dangling import of `useRecents`
  in `solution-list-page.tsx` and no reference to the deleted route.
- `grep -rn '/recent' src/` returns only unrelated matches (the recents *backend*/sort comments),
  never a nav link or route to the deleted page.
- Browser check via `verdict` (workspace, light + dark):
  - The primary nav shows **Solutions · Favorites · Account** — no "Recent".
  - Navigating to `/recent` directly no longer resolves to the old page (Next 404), confirming the
    route is gone.
  - The Solutions hub still renders the **"RECENTLY OPENED"** side rail and the recent-first default
    sort — recents fully preserved.
  - `/favorites` still lists favorites and its empty state works.
