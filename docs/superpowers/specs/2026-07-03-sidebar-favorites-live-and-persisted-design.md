# Sidebar Favorites — Live Rail + Persisted Arrangement — Design Spec

**Date:** 2026-07-03
**Status:** Draft (pending user review)
**Source of truth:** `Genie Control Station.dc.html` (rendered prototype), PINNED rail at lines 209–214, hub star toggle at 296/425/456, favorites route 433–456, drag handlers `dragStartFav`/`dropFav` 1479–1493.
**Supersedes/corrects:** `2026-07-02-design-drift-remediation-design.md` findings **WS-01** ("no defect" — incorrect) and **WS-05** ("persist in a follow-up" — this is that follow-up).

---

## 1. Context — the feature is built, but broken in two ways

The "favorites pinned in the sidebar, draggable to rearrange" feature is **not absent** from the codebase. It is scaffolded end-to-end:

- **DB:** `favorite` table, PK `(userId, solutionId)` (`schema.ts:116`).
- **Server:** `toggleFavorite` mutation (access re-checked), `favorites()` list (access-gated), in `solutions-hub/server/router.ts` + `queries.ts`.
- **Hub star:** `solution-list-row.tsx:33` wires the ★/☆ to `useToggleFavorite`.
- **Rail:** `pinned-favorites.tsx` renders a "PINNED" section (≤6), drag-to-reorder, click-to-open — visually matching the prototype.
- **Layout:** `(workspace)/layout.tsx:26` fetches the first 6 favorites via the server caller and threads them to the rail.

Two real defects make it *behave* as though it is missing:

1. **The rail is frozen after first paint (the reactivity bug).** `PinnedFavorites` copies its `favorites` prop into `useState` once (`pinned-favorites.tsx:59`) and never re-syncs. `useToggleFavorite` calls `router.refresh()` (`hub.ts:47`), which re-runs the server layout and streams a fresh `favorites` prop — but `router.refresh()` preserves client React state, and the workspace layout does not remount on in-app navigation, so the copied state stays stale. **Result: star a solution and nothing appears in the sidebar until a full browser reload.** This was missed by the 2026-07-02 audit (marked "no defect").

2. **The arrangement does not persist.** Drag-reorder mutates local `useState` only. There is no ordering column on `favorite` and no reorder mutation, so any rearrangement resets to server order on reload. The prototype is also session-only here (it has no backend), so persistence is *beyond* strict prototype parity — but it is the expected behavior for "items can be arranged," so we build it.

## 2. Goals / Non-goals

**Goals**
- Starring/unstarring a solution anywhere updates the PINNED rail immediately, no reload.
- The user's drag arrangement of the rail persists across reloads and devices.
- Root-cause the reactivity bug (drive the rail from the live query, not a frozen snapshot) rather than patching with more `router.refresh()`.
- Preserve every existing invariant: access-gating (revoked/archived/drafted favorites never render), the ≤6 rail cap with overflow reachable at `/favorites`, and the prototype's visual/interaction design.

**Non-goals**
- Keyboard-accessible reordering. Native HTML5 DnD (mouse/touch) matches the prototype; rail items stay keyboard-reachable as links. Keyboard reorder is a flagged future enhancement, not in scope.
- Reordering on the `/favorites` full-page list. Reorder remains a rail-only affordance, per prototype (drag handlers exist only on the rail).
- Any change to recents, chat, or unrelated hub behavior.

## 3. Decisions & assumptions

The user was away when scope was chosen; these are the working defaults, each individually reversible on review:

- **Scope = Full persistence** (live rail **and** persisted arrangement). If the user prefers strict prototype parity, drop §4 and the `reorderFavorites` mutation; keep only the §6 reactivity fix.
- **Ordering model = explicit integer `position` column** on `favorite`, ascending. New favorites append to the end. Simple, legible, and adequate for the small per-user favorite counts here.
- **Reorder payload = partition-reindex** (§5.3): the rail sends only the (≤6) ids it rearranged; the server puts them first and appends the rest in their current order. Tolerant of races (a favorite added in another tab simply lands at the end) — no strict set-equality requirement.
- **No data migration.** The new column defaults to `0`; legacy rows tie at `0` and fall back to the existing recency tiebreak, so current ordering is preserved until the user first drags.

## 4. Data model

Add one column to `favorite`:

```
position  integer  NOT NULL  DEFAULT 0
```

- Generate the migration with `pnpm db:generate` (drizzle-kit), review the SQL, apply with `pnpm db:migrate`.
- PK stays `(userId, solutionId)`. `position` is **not** unique — ties are allowed and broken deterministically by the read (§5.1).
- No index needed: favorites are read per-user in small sets; the existing `userId` access path suffices.

## 5. Server changes (`solutions-hub`)

### 5.1 `listFavoriteSolutions` (queries.ts)
Select `favorite.position` and order by `position ASC`, then the existing recency tiebreak (`lastOpenedAt ?? updatedAt` DESC). This keeps legacy `position=0` rows in today's order until they are first arranged. Access-gating (the `customerVisible` predicate join) is unchanged. The function continues to return **all** the user's favorites (no cap) — the cap is a display concern (§6).

### 5.2 `toggleFavorite` — append on add (router.ts)
On the insert branch, set `position = COALESCE((SELECT MAX(position) FROM favorite WHERE user_id = :uid), -1) + 1` so a newly starred solution appends to the end of the arrangement. The delete branch is unchanged (gaps are harmless).

### 5.3 `reorderFavorites` — new mutation (router.ts + schemas/hub.ts)
- **Schema** (`reorderFavoritesSchema`): `{ orderedSolutionIds: z.array(z.string().uuid()).min(1).max(50) }`.
- **Behavior**, in a transaction:
  1. Load the user's favorite `solutionId`s ordered by current `position`.
  2. `provided` = input ids that are actually current favorites (unknown ids dropped, not an error — keeps it race-tolerant).
  3. `rest` = the user's remaining favorites, in current order.
  4. `final = [...provided, ...rest]`; write `position = index` for each row where `user_id = :uid`.
- **Access:** operates only on the caller's own rows; no `canSee` needed (a favorite the user can no longer see just never renders — §5.1 still gates the read).

## 6. Client changes

### 6.1 Rail reads the live query, not a frozen prop (`pinned-favorites.tsx`)
- Drive the source list from `useFavorites()` (already exported from `hub.ts`), seeded for SSR (§6.3). Display `data.slice(0, 6)`. Remove the `useState(favorites)` snapshot; keep only transient drag UI state (`dragId`/`overId`).
- This is the root-cause fix for defect #1: TanStack Query invalidation (from `toggleFavorite`, `reorderFavorites`) now updates the rail reactively, with no reliance on `router.refresh()` or prop re-sync.

### 6.2 Optimistic, persisted reorder (`hub.ts` + `pinned-favorites.tsx`)
- Add `useReorderFavorites()` with an optimistic update: `onMutate` cancels the favorites query, snapshots it, and writes the reordered list into the cache (instant UI); `onError` rolls back; `onSettled` invalidates. On drop, the rail computes the new order of its visible ids and calls the mutation with those ids (§5.3 partitions server-side).
- Remove `router.refresh()` from `useToggleFavorite` (`hub.ts:47`); the reactive query invalidation replaces it. Keep the `invalidateListViews` call so hub/recents/favorites all stay in sync.

### 6.3 Layout stops prop-threading (`layout.tsx`, `workspace-chrome.tsx`)
- In the server layout, replace the `caller.solutionsHub.favorites()` fetch + prop with `prefetch(trpc.solutionsHub.favorites.queryOptions())` and wrap `<WorkspaceChrome>` in `<HydrateClient>` (the pattern `favorites/page.tsx` already uses). This hydrates `useFavorites()` with no flash and no waterfall.
- Drop the `favorites` prop from `WorkspaceChrome` and `PinnedFavorites` — the rail self-fetches. Auth gating in the layout is unchanged.

## 7. Edge cases & error handling

- **Empty favorites:** rail renders nothing (`data.length === 0`), matching today.
- **>6 favorites:** rail shows the first 6 by `position`; the rest remain at `/favorites`. Reordering the visible 6 keeps them authoritative at the top (partition puts them first).
- **Access lapses (revoke/archive/draft):** the favorite row persists but §5.1's gated read drops it; the rail updates on next invalidation/refetch.
- **Reorder mutation fails:** optimistic update rolls back; `onSettled` invalidation restores server truth. No silent failure — the rail reflects the server on settle.
- **Concurrent tabs:** a favorite added in tab B lands at the end; a reorder in tab A drops unknown ids and reindexes — no crash, no cross-tab corruption.

## 8. Testing

The repo has **no unit-test infrastructure** (no Vitest config or `*.test.ts`). Rather than scaffold a test runner (out of scope), the implementation is gated by static checks and manual verification. If/when test infra lands, the server-logic cases below are the ones to cover.

- **Static gates (the automated loop enforces these):** `pnpm db:generate` (clean additive migration, no prompt), `pnpm typecheck`, `pnpm lint`. `pnpm build` is a heavier gate left to the human/CI.
- **Server logic to cover later (Vitest, once infra exists):** `reorderFavorites` partition/reindex (provided-first, rest-appended, unknown ids dropped); `toggleFavorite` appends `MAX(position)+1`; `listFavoriteSolutions` orders by `position` then recency and stays access-gated.
- **Manual / browser (Verdict; Playwright MCP fallback for the drag itself, per the drag-and-drop rule):**
  1. Star a solution on the hub → it appears in the rail **without reload**.
  2. Drag to reorder → order changes; **reload** → order persists.
  3. Unstar (hub or another tab) → it leaves the rail reactively.
  4. Revoke access to a favorited solution → it drops from the rail on refetch.

## 9. Files touched

| File | Change |
|------|--------|
| `src/server/db/schema.ts` | add `position` to `favorite` |
| `drizzle/000X_*.sql` + `meta/*` | generated migration (`pnpm db:generate`) |
| `src/features/solutions-hub/server/queries.ts` | select + order by `position`, recency tiebreak |
| `src/features/solutions-hub/server/router.ts` | `toggleFavorite` appends position; add `reorderFavorites` |
| `src/features/solutions-hub/schemas/hub.ts` | add `reorderFavoritesSchema` |
| `src/features/solutions-hub/api/hub.ts` | add `useReorderFavorites`; drop `router.refresh()` from `useToggleFavorite` |
| `src/app/(workspace)/_components/pinned-favorites.tsx` | self-fetch via `useFavorites`; optimistic persisted reorder; drop frozen `useState` |
| `src/app/(workspace)/_components/workspace-chrome.tsx` | drop `favorites` prop |
| `src/app/(workspace)/layout.tsx` | `prefetch` + `HydrateClient`; drop caller fetch + prop |

## 10. Open questions for review

1. **Scope confirmation** — proceed with Full persistence (§3), or strict prototype parity (reactivity fix only, no DB change)?
2. **Rail cap** — keep 6, or make the visible count configurable?
3. **Legacy ordering** — default-`0` + recency tiebreak is proposed (no data migration). Acceptable, or backfill `position` from current recency order in the migration?
