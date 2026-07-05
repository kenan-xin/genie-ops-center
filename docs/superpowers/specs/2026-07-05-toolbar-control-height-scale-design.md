# Shared control-height scale — design

**Date:** 2026-07-05
**Status:** Approved (design)

## Problem

Form controls that sit side-by-side in admin toolbars render at different
heights, so the toolbars look unpolished. Reported case: the **People** toolbar
(screenshot) shows the search box, the sort dropdown, and the `+ Add person`
button at three visibly different heights.

The root cause is that there is no shared control-height scale. Each primitive
hard-codes its own height, so alignment in a toolbar is accidental:

| Control | Height(s) today |
| --- | --- |
| `Button` | default **40** (`h-10`), sm **32** (`h-8`), auth 44 (`h-11`), icon 40 |
| `Input` | default **40**, auth 42 |
| `Select` | **40** only |
| `AdminSearchInput` | **32** only (hard-coded) |
| `SegmentedControl` | *intrinsic* — no fixed height (`py-2` → ~34) |

Consequences in the current toolbars:

- **People** — search `32` + Select `40` + button `32` → the dropdown is the tall outlier. ✗
- **Solutions** — Input `40` + Segmented `~34` + Select `40` → segmented is short. ✗
- **Groups** — search `32` + button `32` → happens to match. ✓ (accidental)

The same primitives are also used together outside those three toolbars — in
forms (invite/edit person, register solution, theme builder) and in filter rows
(solutions-hub, access-screen, access-overview) — where the missing shared scale
causes the same class of misalignment.

## Decisions

- **All toolbars use a single uniform control height: 40px (`md`).** No
  per-toolbar size — every toolbar is the same height for visual consistency.
- **Introduce a shared control-height scale** as the single source of truth, so
  controls can no longer drift apart.

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
- **`Select`** — add `size?: ControlSize`, default `md`. Already 40, so no visual change.
- **`AdminSearchInput`** — add `size?: ControlSize`. **Default changes 32 → 40 (`md`).**
  Only consumed by the People/Groups toolbars.
- **`SegmentedControl`** — add `size?: ControlSize`. Replace content-height
  `py-2` with a fixed `md` height + vertical centering. **~34 → 40**, so it lines
  up with Inputs in forms and Selects in filter rows.
- **`Button`** — refactor its cva heights to pull from the same constants
  (`sm → h-8`, `default → h-10`, `auth → h-11`). Same values, no visual change;
  keeps Button on the shared scale. `icon` (`size-10`) is unchanged.

### 3. Make all toolbars uniformly 40px

- **People** (`people-directory.tsx`) — search now 40, Select stays 40,
  `+ Add person` button `size="sm" → "default"` (40). ✓
- **Groups** (`groups-directory.tsx`) — search now 40, `+ New group` button
  `size="sm" → "default"` (40). ✓
- **Solutions** (`solutions-directory.tsx`) — Input 40, Segmented now 40, Select
  40; header `+ Add` button `size="sm" → "default"` (40). ✓

## Scope guardrails

- **In scope:** the shared scale module; height wiring for Input, Select,
  AdminSearchInput, SegmentedControl, Button; the three toolbar buttons. Filter
  rows that combine Segmented + Select (access-overview, access-screen,
  solutions-hub) gain aligned heights for free — no code change needed there
  beyond the primitive updates.
- **Out of scope:** form-internal `size="sm"` buttons (edit-person slide-over,
  theme-builder actions, table "Manage" link) stay `sm` — they are not toolbar
  controls. No unrelated refactoring.

## Risks / notes

- **SegmentedControl 34 → 40 is the widest-reaching change.** It affects every
  segmented usage (mostly forms and filter rows), not just the toolbars. This is
  the intended consequence of a shared scale and improves alignment with
  adjacent 40px inputs, but it is a global visual change worth eyeballing.

## Verification

- Visual check: People / Groups / Solutions toolbars — all controls the same
  height; form dialogs — segmented aligns with inputs.
- `pnpm build` and lint pass.
- No new automated tests — the change is presentational.
