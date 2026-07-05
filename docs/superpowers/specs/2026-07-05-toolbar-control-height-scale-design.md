# Shared control-height scale — design

**Date:** 2026-07-05
**Status:** Approved (design)

## Problem

Form controls that sit side-by-side in the app's toolbars render at different
heights, so the toolbars look unpolished. Reported cases: the **People** admin
toolbar (search box / sort dropdown / `+ Add person` button all different
heights) and the **Groups** toolbar (search box vs `+ New group` button).

The root cause is that there is no shared control-height scale. Each primitive
hard-codes its own height, and several toolbars are hand-rolled with inline
styles that bypass the primitives entirely — so alignment is accidental:

| Control | Height(s) today |
| --- | --- |
| `Button` | default **40** (`h-10`), sm **32** (`h-8`), auth 44 (`h-11`), icon 40 |
| `Input` | default **40**, auth 42 |
| `Select` | **40** only |
| `AdminSearchInput` | **32** only (hard-coded) |
| `SegmentedControl` | *intrinsic* — no fixed height (`py-2` → ~34) |
| Hub search box (inline) | **34** (bespoke `<div>` in solutions-hub) |
| Hub `SortSelect` (inline) | **34** (bespoke native `<select>`) |

## Decisions

- **Every horizontal control row uses one uniform height: 40px (`md`).** No
  per-row size variation — visual consistency across the whole app.
- **Introduce a shared control-height scale** as the single source of truth, so
  controls can no longer drift apart.
- **The workspace home hub toolbar migrates onto the shared primitives** (its
  bespoke inline search + `SortSelect` are replaced), rather than being patched
  inline — so it joins the shared scale.

## The alignment rule

> Any horizontal row that combines different control types (search / input /
> select / segmented / button) must have all its members at the shared **40px**
> (`md`) height.

Standalone clusters of a *single* control type (e.g. a group of compact `sm`
action buttons in a slide-over section) are internally consistent and are left
as-is.

## Design

### 1. Single source of truth

New module `src/components/ui/control-size.ts`:

```ts
export const CONTROL_HEIGHTS = { sm: "h-8", md: "h-10", lg: "h-11" } as const; // 32 / 40 / 44
export type ControlSize = keyof typeof CONTROL_HEIGHTS;
```

Every form control derives its height from this map. No control hard-codes
`h-8` / `h-10` / `h-11` for its own height anymore.

### 2. Wire each primitive to the scale (default `md` = 40px)

- **`Input`** — already 40; re-express the **default** height via the map. The
  `auth` size (`h-[42px]`, auth screens only) is left untouched — not a toolbar
  control and not part of this bug.
- **`Select`** — add `size?: ControlSize`, default `md`. Already 40, no visual change.
- **`AdminSearchInput` → rename to `SearchInput`** — it is no longer admin-only
  once the workspace hub uses it. Add `size?: ControlSize`; **default 32 → 40
  (`md`)**. Update its two admin import sites and add the hub as a third consumer.
  Width stays overridable via `className`.
- **`SegmentedControl`** — add `size?: ControlSize`. Replace content-height
  `py-2` with a fixed `md` height + vertical centering. **~34 → 40**, so it lines
  up with inputs in forms and selects in filter rows.
- **`Button`** — refactor its cva heights to pull from the same constants
  (`sm → h-8`, `default → h-10`, `auth → h-11`). Same values, no visual change;
  keeps Button on the shared scale. `icon` (`size-10`) is unchanged.

### 3. Fix every control row to a uniform 40px

Admin toolbars:

- **People** (`people-directory.tsx`) — search now 40, Select stays 40,
  `+ Add person` button `size="sm" → "default"` (40).
- **Groups** (`groups-directory.tsx`) — search now 40, `+ New group` button
  `size="sm" → "default"` (40).
- **Solutions** (`solutions-directory.tsx`) — Input 40, Segmented now 40, Select
  40; header `+ Add` button `size="sm" → "default"` (40).

Workspace + other rows found in the full sweep:

- **Workspace home hub** (`solutions-hub.tsx`) — replace the bespoke inline
  search `<div>` with `SearchInput`, replace `SortSelect` with the shared
  `Select`; `SegmentedControl` becomes 40 via the scale. All row members → 40.
  Remove the now-unused `SortSelect` component.
- **Theme builder top row** (`theme-builder.tsx`) — `Input` (40) paired with
  `Delete` / `Save changes` buttons that are `size="sm"` (32); change those two
  buttons to `size="default"` (40) so the row aligns.

Filter / mode rows that use shared primitives align automatically once the
primitives share the scale (no per-file change needed): access-overview mode
toggle + selects, access-screen Grants/Overview toggle.

## Scope guardrails

**In scope:** the shared scale module; height wiring for Input, Select,
SearchInput (renamed), SegmentedControl, Button; the People/Groups/Solutions
toolbar buttons; the hub toolbar migration; the theme-builder top-row buttons.

**Out of scope (different component classes, verified during the sweep):**

- Solution viewer chrome (`viewer-toolbar`, 30px pills), app headers (32px),
  auth logo, empty-state CTA links (`solution-list-page`, 32px) — not
  form-control toolbars.
- Inline-editable heading fields in the group slide-over
  (`group-inspector.tsx`, borderless click-to-edit title/description) — a
  distinct pattern, not a standard control.
- `sr-only` radio input in `account-action-dialog.tsx` (custom radio card).
- Compact `sm` action-button clusters inside slide-over sections
  (`edit-person-slide-over.tsx`) — single-type groups, internally consistent.
- `Tabs` primitive (used only in `theme-builder`) — section navigation, not an
  inline form-control row; left on its intrinsic height.

## Risks / notes

- **`SegmentedControl` 34 → 40 is the widest-reaching change.** It affects every
  segmented usage (forms, filter rows, view toggles), not just toolbars. This is
  the intended consequence of a shared scale and improves alignment with
  adjacent 40px inputs, but it is a global visual change worth eyeballing.
- **Renaming `AdminSearchInput` → `SearchInput`** touches its two existing import
  sites plus the hub; a mechanical rename, but it is an API change to a shared
  component.
- The hub migration swaps a native `<select>` for the Base UI `Select`; behavior
  is equivalent (the hub is already a client component).

## Verification

- Visual check of every control row: People / Groups / Solutions toolbars, the
  workspace home hub toolbar, the theme-builder top row, and the access filter /
  toggle rows — all members the same 40px height; form dialogs — segmented aligns
  with inputs.
- `pnpm build` and lint pass.
- No new automated tests — the change is presentational.
