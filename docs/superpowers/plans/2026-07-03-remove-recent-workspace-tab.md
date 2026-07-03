# Remove Redundant "Recent" Workspace Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant `/recent` workspace nav tab and route, keeping the recents experience fully in the Solutions hub, and simplify the now favorites-only shared list component.

**Architecture:** Two edits. Task 1 deletes the `Recent` tab surface (nav item + route + header title mapping + two stale doc comments) — recents stay accessible via the hub's "RECENTLY OPENED" rail and recent-first default sort. Task 2 simplifies `SolutionListPage` (now only `/favorites` uses it) by dropping the dead `variant="recents"` branch.

**Tech Stack:** Next.js (App Router) + React 19, TypeScript, tRPC + TanStack Query. Vitest (`pnpm test` → `vitest run`) — currently one suite: `src/features/solutions-hub/lib/reorder.test.ts` (pure favorite-reorder logic; baseline 6/6 passing). No test covers the nav, header, `SolutionListPage`, or the recent route, so this change is not exercised by the existing suite — but `pnpm test` must stay green (6/6) as a regression guard.

**Spec:** `docs/superpowers/specs/2026-07-03-remove-recent-workspace-tab-design.md`

## Global Constraints

- TypeScript; 2-space indent, semicolons, double quotes, trailing commas in multi-line literals.
- NO database, Drizzle schema, migration, or tRPC changes. The recents backend (`solutionsHub.recents`, `useRecents`, open-recording via `s/[slug]`) stays untouched — the hub rail + recent-sort depend on it.
- Do NOT touch the Solutions hub `RecentRail` ("RECENTLY OPENED" sidebar) or the hub's recent-first default sort (`solutionsHub.list({ sort: "recent" })`). These are explicitly preserved.
- Verification per task: `pnpm typecheck` + `pnpm lint` + `pnpm test` (must stay 6/6 green — do NOT add or modify tests; this change has no unit-testable surface), a targeted `grep`, and a `verdict` browser check in light + dark (dev server at `http://localhost:3000`; if `/admin`/workspace 307-redirects to login, run `pnpm reset-admin` once and sign in). Toggle dark mode via the header theme toggle.
- Branch `chore/remove-recent-tab` already exists (spec committed at `7e61abd`).

---

### Task 1: Remove the Recent tab (nav item, route, title mapping, stale comments)

**Files:**
- Modify: `src/app/(workspace)/_components/workspace-nav.tsx` (ITEMS array, line 18)
- Delete: `src/app/(workspace)/recent/page.tsx` (and the emptied `recent/` directory)
- Modify: `src/app/(workspace)/_components/workspace-header.tsx` (`titleFor`, line 17)
- Modify: `src/app/(workspace)/_components/workspace-chrome.tsx` (doc comment, line 22)
- Modify: `src/app/(admin)/_components/admin-chrome.tsx` (doc comment, line 29)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. After this task `SolutionListPage` is still generic (`variant` prop intact) — Task 2 simplifies it. `/favorites` continues to pass `variant="favorites"` and works unchanged.

- [ ] **Step 1: Remove the nav item**

In `src/app/(workspace)/_components/workspace-nav.tsx`, delete the `/recent` entry from `ITEMS`.

From:
```tsx
const ITEMS = [
  { href: "/", label: "Solutions", exact: true },
  { href: "/recent", label: "Recent", exact: false },
  { href: "/favorites", label: "Favorites", exact: false },
  { href: "/account", label: "Account", exact: false },
] as const;
```
To:
```tsx
const ITEMS = [
  { href: "/", label: "Solutions", exact: true },
  { href: "/favorites", label: "Favorites", exact: false },
  { href: "/account", label: "Account", exact: false },
] as const;
```

- [ ] **Step 2: Delete the route**

```bash
git rm src/app/(workspace)/recent/page.tsx
# remove the now-empty directory if git left it (untracked dirs aren't tracked, but be tidy):
rmdir "src/app/(workspace)/recent" 2>/dev/null || true
```

- [ ] **Step 3: Remove the header title mapping**

In `src/app/(workspace)/_components/workspace-header.tsx`, delete line 17 from `titleFor`.

From:
```tsx
function titleFor(pathname: string): string {
  if (pathname === "/") return "Solutions";
  if (pathname.startsWith("/recent")) return "Recent";
  if (pathname.startsWith("/favorites")) return "Favorites";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/s/")) return "Solution";
  return "Workspace";
}
```
To:
```tsx
function titleFor(pathname: string): string {
  if (pathname === "/") return "Solutions";
  if (pathname.startsWith("/favorites")) return "Favorites";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/s/")) return "Solution";
  return "Workspace";
}
```

- [ ] **Step 4: Fix the two stale doc comments**

In `src/app/(workspace)/_components/workspace-chrome.tsx`, update the nav list in the layout comment (~line 22).

From:
```tsx
 *  - Sidebar: G-tile + GENIE wordmark, primary nav (Solutions/Recent/Favorites/
 *    Account), PINNED favorites rail, bottom user footer.
```
To:
```tsx
 *  - Sidebar: G-tile + GENIE wordmark, primary nav (Solutions/Favorites/
 *    Account), PINNED favorites rail, bottom user footer.
```

In `src/app/(admin)/_components/admin-chrome.tsx`, update the padding comment (~line 29) that references the removed page.

From:
```tsx
 * unlike the workspace hub/recent pages (which self-pad via `cs-hubpad`), the
```
To:
```tsx
 * unlike the workspace hub pages (which self-pad via `cs-hubpad`), the
```

- [ ] **Step 5: Typecheck + lint + test + dead-reference grep**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: typecheck/lint pass (only the 5 pre-existing `scripts/` `no-await-in-loop` warnings); `pnpm test` → 6/6 passing (unchanged — nothing in this task is covered by the suite).

Run: `grep -rn "/recent" src/ --include="*.tsx" --include="*.ts"`
Expected: NO nav link, route, or title mapping to `/recent`. Remaining matches are backend/sort context only (e.g. `solutions-hub/api/hub.ts` `{ sort: "recent" }` and `recents` invalidations, `solutions-hub/server/router.ts` "favorite/recent cache" comment). Confirm none is a link/route to the deleted page.

- [ ] **Step 6: Browser verification (light + dark)**

Ensure the dev server is running (`pnpm dev`). Then:
```bash
verdict goto "http://localhost:3000/"
verdict snapshot -i
verdict screenshot /tmp/t1-nav-light.png
```
Verify:
- The primary nav shows **Solutions · Favorites · Account** — no "Recent".
- The Solutions hub still renders the **"RECENTLY OPENED"** side rail and opens recent-first (default sort).
```bash
verdict goto "http://localhost:3000/recent"
verdict url        # expect it NOT to render the old list page
verdict screenshot /tmp/t1-recent-gone.png
```
Verify `/recent` no longer resolves to the old "Recently opened" page (Next renders its 404 / not-found). Then confirm `/favorites` still works:
```bash
verdict goto "http://localhost:3000/favorites"
verdict screenshot /tmp/t1-favorites.png
```
Toggle dark mode (header theme toggle) and re-screenshot the hub to confirm the rail renders in dark too. Save `/tmp/t1-*-dark.png`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(workspace): remove redundant Recent tab (recents stay in the hub)"
```

---

### Task 2: Simplify `SolutionListPage` to favorites-only

With `/recent` gone, `/favorites` is the only caller of `SolutionListPage`; its `variant="recents"` branch and `useRecents` import are dead. Drop them.

**Files:**
- Modify: `src/features/solutions-hub/components/solution-list-page.tsx` (import line 7, signature + query lines 18-29)
- Modify: `src/app/(workspace)/favorites/page.tsx` (remove `variant="favorites"` prop)

**Interfaces:**
- Consumes: `useFavorites()` from `../api/hub` (unchanged signature — returns the favorites query).
- Produces: `SolutionListPage({ title, subtitle, empty })` — the `variant` prop is removed; callers pass only `title`, `subtitle`, `empty`.

- [ ] **Step 1: Drop the `useRecents` import**

In `src/features/solutions-hub/components/solution-list-page.tsx`, line 7.

From:
```tsx
import { useFavorites, useRecents } from "../api/hub";
```
To:
```tsx
import { useFavorites } from "../api/hub";
```

- [ ] **Step 2: Remove the `variant` prop and the branch**

In the same file, update the component signature and the query line.

From:
```tsx
export function SolutionListPage({
  variant,
  title,
  subtitle,
  empty,
}: {
  variant: "recents" | "favorites";
  title: string;
  subtitle: string;
  empty: { icon: string; heading: string; body: string };
}) {
  const query = variant === "recents" ? useRecents() : useFavorites();
```
To:
```tsx
export function SolutionListPage({
  title,
  subtitle,
  empty,
}: {
  title: string;
  subtitle: string;
  empty: { icon: string; heading: string; body: string };
}) {
  const query = useFavorites();
```

(Everything below `const query = ...` — the `has`, skeleton, `List`, `EmptyState` — is unchanged.)

- [ ] **Step 3: Update the favorites page to drop the removed prop**

In `src/app/(workspace)/favorites/page.tsx`, remove the `variant="favorites"` line.

From:
```tsx
      <SolutionListPage
        variant="favorites"
        title="Favorites"
        subtitle="Solutions you've starred for quick access."
        empty={{
          icon: "☆",
          heading: "No favorites yet",
          body: "Tap the ☆ on any solution to pin it here.",
        }}
      />
```
To:
```tsx
      <SolutionListPage
        title="Favorites"
        subtitle="Solutions you've starred for quick access."
        empty={{
          icon: "☆",
          heading: "No favorites yet",
          body: "Tap the ☆ on any solution to pin it here.",
        }}
      />
```

- [ ] **Step 4: Typecheck + lint + test**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: typecheck/lint pass with NO "unused import `useRecents`" or "unused prop" errors, and no caller still passing `variant` (the favorites page was updated in Step 3; `/recent` was deleted in Task 1); `pnpm test` → 6/6 passing (the `reorder.test.ts` favorite-reorder suite is unaffected — it does not import `SolutionListPage`).

- [ ] **Step 5: Browser verification (light + dark)**

```bash
verdict goto "http://localhost:3000/favorites"
verdict screenshot /tmp/t2-favorites-light.png
```
Verify `/favorites` still renders its title/subtitle and either the favorites list or the "No favorites yet" empty state (with the "Browse solutions" link). Confirm the Solutions hub `RecentRail` is still intact (`verdict goto "http://localhost:3000/"`). Toggle dark mode and re-screenshot favorites → `/tmp/t2-favorites-dark.png`.

- [ ] **Step 6: Commit**

```bash
git add src/features/solutions-hub/components/solution-list-page.tsx "src/app/(workspace)/favorites/page.tsx"
git commit -m "refactor(solutions-hub): SolutionListPage is favorites-only after Recent removal"
```

---

## Self-Review

**Spec coverage:**
- Remove nav item → Task 1 Step 1. ✅
- Delete `/recent` route → Task 1 Step 2. ✅
- Remove header title mapping → Task 1 Step 3. ✅
- Update stale comment(s) → Task 1 Step 4 (workspace-chrome + admin-chrome). ✅
- Simplify `SolutionListPage` to favorites-only → Task 2 Steps 1-2. ✅
- Update `favorites/page.tsx` → Task 2 Step 3. ✅
- Keep RecentRail / recent sort / recents backend → Global Constraints + verified in Task 1 Step 6 & Task 2 Step 5. ✅
- Verification (typecheck, lint, grep, verdict light/dark) → every task. ✅

**Placeholder scan:** No TBD/TODO; every code step shows exact before/after. ✅

**Type/consistency:** Task 2 removes the `variant` prop; the only two callers are `/recent` (deleted in Task 1) and `/favorites` (updated in Task 2 Step 3) — no caller references the removed prop after both tasks. `useRecents` remains exported from `../api/hub` and still used by the hub `RecentRail` (untouched). ✅
