# Design Drift — Wave C2 (Admin → Groups / Access) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin Groups directory, the shared transfer list, and the Access overview into pixel/token/copy conformance with the prototype — resolving all seven AG findings (AG-01…AG-07).

**Architecture:** Reuse the patterns established in Wave C1: the directory grid rebuilds on TanStack Table + a `<colgroup>` whose widths reproduce the prototype's `fr` template (D1), the toolbar reuses the 32px `AdminSearchInput` composite + an ink-filled `Button variant="dark" size="sm"`, and `StatusBadge` misuse is replaced by the Wave-A `Chip` primitive. The shared `TransferList` primitive is parameterized (pane height + container gap) so the Grants list can adopt the prototype's tall clamped panes without regressing the group-inspector members list, which the prototype draws at different dimensions.

**Tech Stack:** Next.js 16 (app router) · React 19 · Tailwind v4 + shadcn-on-Base-UI · `@tanstack/react-table@8` · `@tanstack/react-query` · tRPC + zod · Drizzle ORM.

## Global Constraints

_Every task's requirements implicitly include this section._

- **Prototype is the ground truth.** Source: `docs/design-package/Genie Control Station.dc.html`. Where the current build and the prototype disagree, the prototype wins. Line refs in tasks point into this file.
- **Never use a fixed-px font utility.** `text-xs` renders Tailwind's fixed `0.75rem` and is a violation. Always use the token utilities: `text-body`=`--t-body`, `text-small`=`--t-sm` (and `--t-xs`===`--t-sm`===`text-small`), `text-title`=`--t-title`(=`--t-h3`), `text-cardhead`, and the mono sizes `text-mono-xs`=`--m-xs`, `text-mono-sm`=`--m-sm`, `text-mono-md`=`--m-md`, `text-mono-lg`=`--m-lg`.
- **Fonts:** `font-sans`=Hanken Grotesk, `font-heading`=Archivo, `font-mono`=IBM Plex Mono. A `text-mono-*` utility sets **size only**; the mono family requires `font-mono`.
- **Color tokens (use the CSS vars, never literals):** `var(--ink)` (#14161b), `var(--ink2)` (#4a515c), `var(--ink3)` (#8b929c), `var(--line)` (#c8cdd5), `var(--line2)` (#e2e5ea), `var(--panel)` (#f6f7f9), `var(--surface)` (#fff), `var(--brand)`/`var(--brandink)` (#2360c4), `var(--brandtint)` (#eef4fc), `var(--error)` (#d94032). Literals given only to confirm the prototype match.
- **`Chip` vs `StatusBadge`:** `Chip` = mixed-case sans, 1px `--line` border, 2px radius, surface fill (tags: group names, people-reached). `StatusBadge` = mono uppercase on a semantic tint (lifecycle status). Do not swap them; AG-06 replaces a StatusBadge misuse with a Chip.
- **Shared primitives must not regress other consumers.** `transfer-list.tsx` (kit) is used by BOTH the Access Grants list and the group-inspector Members list; `admin-search-input.tsx` is used by People (C1) and will be used by Solutions (C3). Changes are additive/parameterized, verified against every consumer.
- **Verification cycle (no unit-test runner):** `pnpm typecheck` (tsc) + `pnpm lint` (oxlint) must both be clean. lefthook's pre-commit runs oxfmt+oxlint ONLY (not tsc), so `pnpm typecheck` must be run explicitly as the last gate. Visual QA via `verdict` where a surface is reachable — the local admin login is restored (`admin@example.com` / `Sup3rSecret!pw`; re-run `pnpm reset-admin` if it breaks).
- **Implementer/reviewer model:** `sonnet` (per memory `dispatch-sonnet-implementers`); scale the final whole-branch review to `opus`.

## Adopted decisions (overridable at the post-C2 checkpoint)

- **D1-C2 — Groups directory conforms to the prototype's 3-column grid.** The prototype row template is `2.6fr .9fr 40px` = **GROUP / MEMBERS / (40px chevron)** with **no Solutions column** (`.dc.html:732,734`). The current build has a fourth "Solutions" count column. Conformance drops the Solutions count from the directory row. The grant count remains visible in the group inspector ("N GRANTED") and throughout Access, so no information is lost from the product — only from this one row. Flag at the checkpoint; trivially reversible.
- **D2-C2 — Reuse the TanStack + colgroup pattern (D1 from C1).** The Groups search stays **server-side** (`useGroupsQuery(search)`); TanStack is used for the column model + `flexRender` + colgroup widths only (no client `globalFilter`). AG-02 is a visual swap of the search input and button, not a search-architecture change.
- **D3-C2 — Promote `AdminSearchInput` to the kit.** Move `admin-search-input.tsx` from `src/features/users/components/` to `src/components/ui/` (it is a generic admin primitive with no users-domain logic, consumed by People + Groups + Solutions). Prevents cross-feature imports for C2 and C3.

---

## File Structure

- `src/components/ui/admin-search-input.tsx` — **moved** from `src/features/users/components/` (D3-C2). Unchanged content; new location.
- `src/features/users/components/people-directory.tsx` — **modify** one import line (new AdminSearchInput path).
- `src/features/groups/components/groups-directory.tsx` — **rebuild** the directory table region on TanStack + colgroup (AG-01), swap the toolbar (AG-02), fix the description font (AG-03). `CreateGroupDialog` (same file) is unchanged.
- `src/components/ui/transfer-list.tsx` — **modify**: parameterize pane height + container gap (AG-04); add header quick-links (AG-05).
- `src/features/groups/components/group-inspector.tsx` — **modify**: pass the members-list dimension overrides so it keeps its own prototype dims (AG-04 no-regression).
- `src/features/groups/components/grants-panel.tsx` — **modify** (cosmetic): loading-skeleton height matches the new pane clamp.
- `src/features/groups/components/access-overview.tsx` — **modify**: people-reached chips → `Chip` (AG-06); by-solution right-side badge → mono type pill (AG-07); drop now-unused `StatusBadge`/`STATUS_TONE`.
- `src/features/groups/server/group-service.ts` — **modify**: add `type` to `SolutionReach.solution` and to the `overviewBySolution` select (AG-07 data).
- `docs/execution-log/index.md` — **append** the Wave C2 entry (Task 4).

---

## Task 1: Groups directory — grid rebuild + toolbar + description (AG-01 P0, AG-02, AG-03)

**Files:**
- Move: `src/features/users/components/admin-search-input.tsx` → `src/components/ui/admin-search-input.tsx` (D3-C2)
- Modify: `src/features/users/components/people-directory.tsx` (import path only)
- Modify: `src/features/groups/components/groups-directory.tsx`

**Interfaces:**
- Consumes: `AdminSearchInput` (32px composite, `{ value, onChange, placeholder, "aria-label"? }`); kit `Table`/`TableScroll`/`TableHead`/`TableCell`/`TableRow`/`TableHeader`/`TableBody` (already prototype-styled: mono-uppercase `--m-xs` header on `--panel`, `px-4 py-4` cells, `--line2` row borders, hover `--panel`); `Button` `variant="dark"` (bg `--ink`, `text-on-ink`, `font-bold`) `size="sm"` (`h-8 px-3`); `GroupSummary` (`{ id, name, description|null, memberCount, solutionCount }`); `useGroupsQuery(search)`.
- Produces: nothing new consumed by later tasks.

**Prototype refs:** header row `.dc.html:732`; data row `:734–737`; toolbar `:726–728`; search `:727`; button `:728`.

- [ ] **Step 1: Move `AdminSearchInput` to the kit (D3-C2).**

`git mv src/features/users/components/admin-search-input.tsx src/components/ui/admin-search-input.tsx`. The file content is unchanged. Update its top doc comment's "Consumed by the People directory (C1)…" line to read "Consumed by the People/Groups/Solutions admin toolbars." Then update the import in `people-directory.tsx`:

```tsx
// was: import { AdminSearchInput } from "./admin-search-input";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
```

- [ ] **Step 2: Rebuild the directory's table region on TanStack + colgroup (AG-01) and fold in the description font (AG-03).**

Replace the imports, add the column factory + width map, and rewrite the `GroupsDirectory` table block. Keep `CreateGroupDialog` (below in the same file) exactly as-is. New top-of-file additions:

```tsx
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
// ...existing react-hook-form / next / react imports...
import { AdminSearchInput } from "@/components/ui/admin-search-input";
// ...existing kit imports (Button, Dialog*, EmptyState, FieldError, Input, Label,
//    Skeleton, Table*, useToast)...
import { useCreateGroup, useGroupsQuery } from "../api/groups";
import {
  createGroupSchema,
  type CreateGroupValues,
  type GroupSummary,
} from "../schemas/group";
import { GroupInspector } from "./group-inspector";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

// Prototype row grid `2.6fr .9fr 40px` (.dc.html:734): a fixed 40px chevron
// column; the two flexible columns split the remainder 2.6 : 0.9 (= 26 : 9 of
// 35). `table-fixed` honors calc() <col> widths, so the chevron stays 40px at
// any table width while GROUP/MEMBERS keep the ratio.
const COLUMN_WIDTHS: Record<string, string> = {
  group: "calc((100% - 40px) * 26 / 35)",
  members: "calc((100% - 40px) * 9 / 35)",
  chevron: "40px",
};

const columnHelper = createColumnHelper<GroupSummary>();

// Module-level column factory (not inline in the component) so oxlint's
// no-unstable-nested-components doesn't flag the `cell` render fns.
function buildColumns() {
  return [
    columnHelper.accessor("name", {
      id: "group",
      header: "Group",
      cell: (info) => {
        const g = info.row.original;
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-bold text-[var(--ink)]">{g.name}</span>
            {g.description ? (
              <span className="truncate text-small text-[var(--ink3)]">{g.description}</span>
            ) : null}
          </span>
        );
      },
    }),
    columnHelper.accessor("memberCount", {
      id: "members",
      header: "Members",
      cell: (info) => (
        <span className="font-mono text-mono-md font-semibold text-[var(--ink2)]">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: "chevron",
      header: "",
      cell: () => (
        <span aria-hidden className="block text-right text-title text-[var(--line)]">
          ›
        </span>
      ),
    }),
  ];
}
```

Inside `GroupsDirectory`, after the existing state/query hooks, build the table:

```tsx
const columns = useMemo(() => buildColumns(), []);
const table = useReactTable({
  data: groups ?? [],
  columns,
  getCoreRowModel: getCoreRowModel(),
});
```

(Add `useMemo` to the react import. `groups` is the `useGroupsQuery` data; keep the existing `isPending`/`isError`/`error`/`term` handling.)

Replace the toolbar + table JSX (the block currently spanning the search/button row through the `</TableScroll>` / EmptyState branch) with:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <AdminSearchInput
    value={search}
    onChange={setSearch}
    placeholder="Search groups…"
    aria-label="Search groups"
  />
  <Button
    variant="dark"
    size="sm"
    className="px-[14px]"
    onClick={() => setCreateOpen(true)}
  >
    + New group
  </Button>
</div>

{isPending ? (
  <div className="flex flex-col gap-2">
    {SKELETON_ROWS.map((i) => (
      <Skeleton key={i} className="h-11 w-full" />
    ))}
  </div>
) : isError ? (
  <p className="text-small text-[var(--error)]">
    {(error as { message: string }).message || "Couldn't load groups."}
  </p>
) : groups.length === 0 ? (
  <EmptyState
    title={term ? "No groups match your search" : "No groups yet"}
    description={
      term
        ? "Try a different group name."
        : "Create a group, add people, and grant it solutions to manage access."
    }
    action={!term ? <Button onClick={() => setCreateOpen(true)}>New group</Button> : undefined}
  />
) : (
  <TableScroll>
    <Table className="min-w-[480px] table-fixed">
      <colgroup>
        {table.getAllLeafColumns().map((column) => (
          <col key={column.id} style={{ width: COLUMN_WIDTHS[column.id] }} />
        ))}
      </colgroup>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => setOpenId(row.original.id)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableScroll>
)}
```

Notes: (a) the "Solutions" column is intentionally gone (D1-C2); `solutionCount` is simply not rendered here. (b) The description now uses `text-small` sans (was `text-mono-xs`), resolving AG-03 — the prototype's description is sans `--t-xs`, and `--t-xs`===`--t-sm`===`text-small`. (c) The `Input` kit import is still used by `CreateGroupDialog`; keep it.

- [ ] **Step 3: Verify.**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean (only the pre-existing `scripts/` warnings, if any).

- [ ] **Step 4: Visual check (login restored).**

`verdict goto http://localhost:3000/admin/groups` (sign in `admin@example.com` / `Sup3rSecret!pw` if prompted), `verdict snapshot -i`. Confirm: 3-column rows (Group / Members / chevron), 32px search with circle glyph, ink-filled "+ New group" button, sans description sub-line. If the dev server or login is unavailable, diff-review and note it.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ui/admin-search-input.tsx \
        src/features/users/components/people-directory.tsx \
        src/features/groups/components/groups-directory.tsx
git commit -m "fix(admin-groups): rebuild directory on 3-col grid, ink toolbar, sans desc (AG-01/02/03)

- AG-01 (P0): TanStack + colgroup reproducing 2.6fr .9fr 40px (GROUP/MEMBERS/chevron); drop Solutions col (D1-C2)
- AG-02: AdminSearchInput (32px, glyph) + Button dark/sm '+ New group'; promote AdminSearchInput to kit (D3-C2)
- AG-03: description text-mono-xs -> text-small (sans --t-xs)"
```

---

## Task 2: Shared TransferList — clamp height + 24px gap + header quick-links (AG-04 P1, AG-05 P1)

**Files:**
- Modify: `src/components/ui/transfer-list.tsx`
- Modify: `src/features/groups/components/group-inspector.tsx` (members-list overrides — no-regression)
- Modify: `src/features/groups/components/grants-panel.tsx` (skeleton height — cosmetic)

**Interfaces:**
- Consumes: existing `TransferList` props (`items`, `value`, `onChange`, `availableLabel`, `targetLabel`, `className`).
- Produces: `TransferList` gains an optional `paneHeightClassName?: string` prop (default `"h-[clamp(380px,52vh,640px)]"`) applied to each pane's scroll `<ul>`; the container default gap becomes `gap-6` (overridable via `className`). New header quick-links: "Add all shown →" (Catalog/available side) moves all currently-shown available items to the target; "Revoke all" (Granted/target side) clears the entire target set.

**Prototype refs:** grants container `gap:24px` `.dc.html:805`; pane `height:clamp(380px,52vh,640px)` `:810,822`; "Add all shown →" `:808` (csnav, `600 --t-xs 'Hanken Grotesk'`, `--brandink`); "Revoke all" `:820` (csnav, `--ink2`); inspector-members list (different dims: `gap:10px` `:764`, `max-height:300px`) `:764–789`.

- [ ] **Step 1: Parameterize the pane height + container gap (AG-04).**

In `TransferList`, add `paneHeightClassName` to the props and default the container gap to `gap-6`:

```tsx
export function TransferList({
  items,
  value,
  onChange,
  availableLabel = "Available",
  targetLabel = "Granted",
  className,
  paneHeightClassName = "h-[clamp(380px,52vh,640px)]",
}: {
  items: TransferItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  availableLabel?: string;
  targetLabel?: string;
  className?: string;
  paneHeightClassName?: string;
}) {
```

Container: `cn("grid grid-cols-1 gap-6 sm:grid-cols-2", className)` (was `gap-3`).

In `TransferSide`, add `paneHeightClassName: string` to `SideProps` and apply it to the scroll list, replacing the fixed `max-h-64 min-h-32`:

```tsx
<ul className={cn(paneHeightClassName, "overflow-y-auto")}>
```

Thread `paneHeightClassName={paneHeightClassName}` to both `<TransferSide>` instances in `TransferList`.

- [ ] **Step 2: Add the header quick-links (AG-05).**

Extend `SideProps` with `onHeaderAction?: (filteredIds: string[]) => void` and `headerActionLabel?: string`. In `TransferSide`, render the link in the mono-heading bar (right side; the bar already uses `justify-between`). Show it on the available side only when there are shown items, and on the target side only when the target has items:

```tsx
{onHeaderAction && (isTarget ? items.length > 0 : filtered.length > 0) ? (
  <button
    type="button"
    onClick={() => onHeaderAction(filtered.map((i) => i.id))}
    className={cn(
      "shrink-0 text-small font-semibold whitespace-nowrap transition-colors hover:text-[var(--ink)]",
      isTarget ? "text-[var(--ink2)]" : "text-[var(--brandink)]",
    )}
  >
    {headerActionLabel}
  </button>
) : null}
```

In `TransferList`, add the two handlers and wire them per side:

```tsx
function addAllShown(ids: string[]) {
  const add = ids.filter((id) => !valueSet.has(id));
  if (add.length === 0) return;
  onChange(Array.from(new Set([...value, ...add])));
  setAvailableSelected(new Set());
}

function revokeAll() {
  if (value.length === 0) return;
  onChange([]);
  setTargetSelected(new Set());
}
```

Available `<TransferSide>`: `onHeaderAction={addAllShown}` and `headerActionLabel="Add all shown →"`.
Target `<TransferSide>`: `onHeaderAction={() => revokeAll()}` and `headerActionLabel="Revoke all"` (the target link revokes ALL granted items — prototype copy is "Revoke all", not "…shown" — so it ignores the passed filtered ids).

- [ ] **Step 3: Preserve the inspector-members dimensions (AG-04 no-regression).**

The prototype draws the group-inspector Members dual-list at `gap:10px` + `max-height:300px` (`.dc.html:764,772`), NOT the grants clamp. In `group-inspector.tsx`, pass overrides so the shared default change doesn't alter it:

```tsx
<TransferList
  items={memberItems}
  value={detail.memberIds}
  onChange={(ids) => void commitMembers(ids)}
  availableLabel="Available people"
  targetLabel="Members"
  className="gap-2.5"
  paneHeightClassName="max-h-[300px]"
/>
```

(`gap-2.5`=10px overrides the new `gap-6` default via twMerge; `max-h-[300px]` restores the content-driven pane.) The inspector members list gets NO header quick-links (prototype omits them there) — leaving `onHeaderAction` unset on the members `TransferList` is automatic, since only the internal Grants/Catalog wiring passes them.

- [ ] **Step 4: Grants loading skeleton (cosmetic).**

In `grants-panel.tsx`, bump the `GrantsTransfer` loading skeleton from `h-64` to `h-[clamp(380px,52vh,640px)]` so the loaded pane height doesn't jump. (Leave the `GrantsPanel`-level skeleton as-is.)

- [ ] **Step 5: Verify.**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [ ] **Step 6: Visual check.**

`verdict goto http://localhost:3000/admin/groups/access?mode=grants` → snapshot. Confirm: two tall clamped panes with a 24px gap, "Add all shown →" (brand) in the Catalog header and "Revoke all" (ink2) in the Granted header, both functional. Then `verdict goto` the group inspector (open a group from `/admin/groups`) → confirm the Members dual-list is still the shorter `max-h-[300px]` + 10px gap with no header links.

- [ ] **Step 7: Commit.**

```bash
git add src/components/ui/transfer-list.tsx \
        src/features/groups/components/group-inspector.tsx \
        src/features/groups/components/grants-panel.tsx
git commit -m "fix(admin-access): transfer-list clamp height + 24px gap + header quick-links (AG-04/05)

- AG-04: parameterized paneHeightClassName (default clamp(380px,52vh,640px)) + gap-6 default; inspector members keep 300px/gap-10 via overrides
- AG-05: 'Add all shown ->' (available) / 'Revoke all' (target) header quick-links"
```

---

## Task 3: Access overview — people chips + by-solution type pill (AG-06 P2, AG-07 P2)

**Files:**
- Modify: `src/features/groups/server/group-service.ts` (AG-07 data)
- Modify: `src/features/groups/components/access-overview.tsx`

**Interfaces:**
- Consumes: `Chip` (kit; `{ tone?, truncate?, className? }`, default mixed-case sans, `--line` border, 2px radius); `SolutionReach` (`overviewBySolution` output).
- Produces: `SolutionReach.solution` gains a `type: "chat" | "native" | "embedded"` field.

**Prototype refs:** people-reached chip `.dc.html:863` (`600 --t-xs 'Hanken Grotesk'`, `--line` border, `2px` radius, `4px 10px`, `--ink` on `--surface`); by-solution type pill `:850` (`600 --m-sm 'IBM Plex Mono'`, `--brandink` on `--brandtint`, `5px 10px`, no border/radius, value uppercased type with embedded→`EMBED`).

- [ ] **Step 1: Plumb `solution.type` through `overviewBySolution` (AG-07 data).**

In `group-service.ts`, extend the `SolutionReach` type's `solution` field:

```tsx
export type SolutionReach = {
  solution: SolutionOption & { type: "chat" | "native" | "embedded" };
  groups: { id: string; name: string; memberCount: number }[];
  people: { id: string; name: string; email: string }[];
};
```

Add `type` to the `overviewBySolution` solutions select (alongside `status`, `archived`):

```tsx
.select({
  id: solution.id,
  name: solution.name,
  monogram: solution.monogram,
  accentColor: solution.accentColor,
  accentColorInvert: solution.accentColorInvert,
  status: solution.status,
  archived: solution.archived,
  type: solution.type,
})
```

(The selected row flows straight into `SolutionReach.solution`, so no further mapping change is needed. `solution` is already imported in this file.)

- [ ] **Step 2: People-reached chips → `Chip` (AG-06).**

In `access-overview.tsx`, import `Chip` (`import { Chip } from "@/components/ui/chip";`) and replace the people-reached block (currently the `StatusBadge tone="neutral"` map, ~lines 164–170):

```tsx
<div className="flex flex-wrap gap-1.5 px-4 py-3.5">
  {selected.people.map((p) => (
    <Chip key={p.id} truncate className="max-w-[180px] px-[10px] py-1 font-semibold">
      {p.name}
    </Chip>
  ))}
</div>
```

(Chip default padding is `px-[7px] py-[2px]` weight 500; the prototype chip is `4px 10px` weight 600, so override `px-[10px] py-1` + `font-semibold`. `py-1`=4px.)

- [ ] **Step 3: By-solution right-side badge → mono type pill (AG-07).**

Add a module-level label map (the prototype uppercases the type, with embedded→`EMBED`):

```tsx
const SOLUTION_TYPE_LABEL: Record<"chat" | "native" | "embedded", string> = {
  chat: "CHAT",
  native: "NATIVE",
  embedded: "EMBED",
};
```

Replace the summary-bar right-side badge (currently the `selected.solution.archived ? <StatusBadge>Archived</StatusBadge> : <StatusBadge tone=… dot>…</StatusBadge>` block, ~lines 121–127) with a single type pill:

```tsx
<span className="bg-[var(--brandtint)] px-[10px] py-[5px] font-mono text-mono-sm font-semibold uppercase text-[var(--brandink)]">
  {SOLUTION_TYPE_LABEL[selected.solution.type]}
</span>
```

(`overviewBySolution` already filters `archived = false`, so the old "Archived" branch was dead; the type pill fully replaces both.)

- [ ] **Step 4: Remove now-unused symbols.**

After Steps 2–3, `StatusBadge` and the `STATUS_TONE` const in `access-overview.tsx` have no remaining references. Delete the `STATUS_TONE` const and the `StatusBadge` import so `pnpm lint` stays clean. (Grep the file to confirm zero remaining `StatusBadge`/`STATUS_TONE` uses before deleting.)

- [ ] **Step 5: Verify.**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean (no unused-import/var errors).

- [ ] **Step 6: Visual check.**

`verdict goto http://localhost:3000/admin/groups/access?mode=overview` → snapshot. Confirm: people-reached shows mixed-case bordered sans chips (not uppercase mono badges); the by-solution summary bar's right element is a `CHAT`/`NATIVE`/`EMBED` mono pill on brandtint (not a status badge).

- [ ] **Step 7: Commit.**

```bash
git add src/features/groups/server/group-service.ts \
        src/features/groups/components/access-overview.tsx
git commit -m "fix(admin-access): people chips + by-solution type pill (AG-06/07)

- AG-06: people-reached StatusBadge -> Chip (mixed-case sans, bordered)
- AG-07: by-solution right badge -> mono type pill (CHAT/NATIVE/EMBED); plumb solution.type through overviewBySolution"
```

---

## Task 4: Verify branch + execution log

**Files:**
- Modify: `docs/execution-log/index.md`

- [ ] **Step 1: Full-branch verify.**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean across the whole branch (only pre-existing `scripts/` warnings).

- [ ] **Step 2: Visual QA sweep (login restored).**

With `pnpm dev` running and signed in as `admin@example.com`, `verdict` snapshot all three surfaces at the 920 / 1180 / 1440 breakpoints: `/admin/groups`, `/admin/groups/access?mode=grants`, `/admin/groups/access?mode=overview`, and the group inspector. Note any residual drift. If a surface is unreachable, record what was diff-reviewed instead.

- [ ] **Step 3: Append the Wave C2 execution-log entry.**

Add a dated Wave C2 section to `docs/execution-log/index.md` summarizing: the 7 AG findings resolved, decisions D1-C2 (dropped Solutions column) / D2-C2 (server search kept) / D3-C2 (AdminSearchInput promoted to kit), the shared-primitive parameterization (transfer-list) and its no-regression handling for the inspector, and any accepted deviations / open follow-ups.

- [ ] **Step 4: Commit.**

```bash
git add docs/execution-log/index.md
git commit -m "docs(log): Wave C2 admin Groups/Access complete — 3-col grid, transfer-list clamp+quick-links, chips/type-pill"
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** AG-01 (T1 grid), AG-02 (T1 toolbar), AG-03 (T1 description), AG-04 (T2 clamp+gap), AG-05 (T2 quick-links), AG-06 (T3 chips), AG-07 (T3 type pill + data). All seven mapped.
- **Placeholder scan:** none — every step carries exact classes, tokens, copy, and colgroup calc values.
- **Type consistency:** `GroupSummary`, `SolutionReach`, `SolutionOption`, `TransferItem`/`SideProps` names match their definitions; the new `paneHeightClassName` prop and `SolutionReach.solution.type` union are used identically across producer and consumer.
- **Shared-primitive safety:** `transfer-list.tsx` change is additive (new optional prop + default gap) with the inspector explicitly overridden; `admin-search-input.tsx` move updates its one existing consumer (People) in the same task.
