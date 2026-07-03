# Theme Builder — selected-state fixes + theme naming

**Date:** 2026-07-03
**Status:** Design — awaiting review
**Scope:** `src/features/themes/components/theme-builder.tsx`, `src/components/ui/tabs.tsx`
**No** database, schema, or tRPC changes.

## Problem

Two issues in the admin Theme Builder (`/admin/themes`):

1. **Weak / broken selected + hover states.** Reported for the preset cards. Investigation
   (live DOM + computed styles + base-ui source, verified in the running app) found this is
   **two distinct problems**:
   - **Shared component bug (Tabs).** `components/ui/tabs.tsx` styles the selected tab with
     `data-[selected]:bg-[var(--ink)] data-[selected]:text-[var(--on-ink)]`, but base-ui's
     `Tabs.Tab` is built on `useCompositeItem` and emits **`data-active` + `aria-selected="true"`,
     never `data-selected`**. The selector never matches, so the selected tab computes to
     `background: transparent; color: var(--ink2)` — visually identical to the unselected tabs.
     This is a real defect in the shared component; it would break selected styling anywhere
     `Tabs` is used (today only this screen).
   - **Local weakness (preset cards).** The selected preset card *does* render, but only as a
     1px brand border + 1px ring — far subtler than the app's established selected language
     (ink-fill on `SegmentedControl`; brand-border + `--brandtint` fill on `ThemeChip`).
     Hover-while-selected also uses the same grey (`--panel`) as inactive hover, so there is no
     distinct feedback. This is a styling inconsistency, not a broken selector.
   - **Not affected:** `SegmentedControl` and `ThemeChip` use a boolean `active` class and work
     correctly. `select.tsx`'s `data-[selected]` is correct because base-ui's `Select.Item`
     genuinely emits `data-selected` (a different component from `Tabs.Tab`).

2. **No discoverable way to name / rename a theme.** Renaming is not missing — the name `<Input>`
   is **buried inside the Elements tab**. When a user picks a preset (on the Presets tab) or clicks
   "+ New theme" (which creates a theme literally named "New theme"), there is no visible name
   field; they must know to switch to Elements to rename. This is why the seed data shows two
   themes both named "New theme".

## Goals

- Selected preset card and selected tab are unmistakable, consistent with the rest of the app,
  and provide distinct hover feedback.
- A theme can be named the moment it is created or a preset is picked, and renamed at any time,
  without hunting through tabs.
- No regressions to `SegmentedControl`, `ThemeChip`, `Select`, or dark mode.

## Non-goals (flag to include if wanted)

- Auto-naming a theme from the picked preset (risks clobbering a user-typed name).
- Enforcing unique theme names (no uniqueness constraint exists today).
- Auto-focusing the name field on "+ New theme".

## Design decisions (recommended — confirm at review)

- **Issue #1 preset card → Option A: brand border + `--brandtint` fill.** Matches the existing
  Saved-theme chips and the account-dialog selected-card pattern. Clearly selected without the
  heaviness of an ink fill (Option B), which competes with the color-swatch bar and reads like a
  different control. (Option C = A + a ✓ badge; available if maximal clarity is preferred.)
- **Issue #2 name → Layout A: always-visible header field.** Name input in the editor's top row
  next to Save/Delete, editable on any tab; removed from Elements. Simplest change that fully
  fixes discoverability. (Alternatives considered: B click-to-rename title; C name-on-create
  dialog — both leave first-time naming or rename less obvious.)

Mockups of all options rendered with real tokens: `/tmp/theme-builder-mockups.html`.

## Changes

### Change 1 — Fix Tabs selected state (`src/components/ui/tabs.tsx`, `TabsTab`)

Replace the never-matching `data-[selected]:` utilities with base-ui's real attribute:

- `aria-selected:bg-[var(--ink)] aria-selected:text-[var(--on-ink)]` for the selected fill.
- Keep `hover:bg-[var(--panel)]` for unselected hover feedback, but add
  `aria-selected:hover:bg-[var(--ink)]` so hovering the **selected** tab does not flip it to grey.
- Everything else (padding, focus ring, transition) unchanged.

Rationale for `aria-selected` over `data-active`: it is semantic, present as `aria-selected="true"`,
and matched by Tailwind's built-in `aria-selected` variant.

### Change 2 — Preset card selected state (`theme-builder.tsx`, preset `<button>`)

Keep the base (`border border-[var(--line)] bg-[var(--surface)]`) and idle `hover:bg-[var(--panel)]`.
Replace the selected treatment:

- From: `data-[active=true]:border-[var(--brand)] data-[active=true]:ring-1 data-[active=true]:ring-[var(--brand)]`
- To: `data-[active=true]:border-[var(--brand)] data-[active=true]:bg-[var(--brandtint)]`
  plus `data-[active=true]:hover:bg-[var(--brandtint)]` so hover-while-selected keeps the tint.

This mirrors the `ThemeChip` recipe (`border-[var(--brand)] bg-[var(--brandtint)]`). Label
(`text-foreground`) and description (`text-[var(--ink3)]`) remain legible on the pale tint. The
`focus-visible:ring-2 focus-visible:ring-ring` a11y ring is retained. Selection continues to be
driven by `data-active={config.preset === preset.id}` (unchanged), so exactly one card is active
and it persists across save/reload via the stored `config.preset`.

### Change 3 — Theme name header field (`theme-builder.tsx`, `ThemeBuilderEditor`)

- Move the name `<Input id="theme-name" {...register("name")} />` and its `FieldError`, and the
  **Delete** button, out of the Elements `TabsPanel` and into the editor header row (the row that
  currently holds only the Save button).
- New header row: name input (`flex-1`) on the left; **Delete** + **Save changes** on the right;
  `flex flex-wrap items-center gap-3` so it wraps cleanly on narrow widths. The `FormError`
  (`errors.root`) stays directly below.
- The Elements `TabsPanel` now leads with the "Header & accent" swatch field.
- `ThemePreview` continues to receive `name` via `useWatch` — unchanged.

Net effect: naming works immediately on the Presets tab (fixing "no way to name when picking a
preset"), and rename is always visible (fixing buried rename).

## Files touched

- `src/components/ui/tabs.tsx` — `TabsTab` class list (selected + hover). Shared; only the Theme
  Builder consumes it today, so no other screen changes visually.
- `src/features/themes/components/theme-builder.tsx` — preset card class list; relocate name input
  + Delete into the header row; remove them from the Elements panel.

## Verification

- `pnpm typecheck` and `pnpm lint` pass.
- Browser checks via verdict, **light and dark**:
  - Tabs: selected tab shows ink fill + white text; hovering an unselected tab shows the panel
    grey; hovering the selected tab keeps the ink fill.
  - Preset cards: selected card shows brand border + tint; idle hover shows panel; exactly one
    card selected; selection persists after Save → reload.
  - Name: editable from the header on Presets, Elements, and Custom CSS tabs; rename persists on
    Save; a freshly created theme shows its editable name; Delete still works from the header.
