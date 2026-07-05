# Shared Control-Height Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every horizontal form-control row (search / input / select / segmented / button) render at a uniform 40px height, driven by a shared control-height scale, so toolbars stop looking ragged.

**Architecture:** Introduce one source-of-truth module (`control-size.ts`) exporting the height class scale. Wire each UI primitive (`Button`, `Input`, `Select`, `SegmentedControl`, and the renamed `SearchInput`) to it. Then fix each consuming row to 40px, including migrating the bespoke workspace-home hub toolbar onto the shared primitives.

**Tech Stack:** Next.js (App Router) · React · TypeScript · Tailwind CSS (via `cn`/`twMerge`) · `class-variance-authority` · Base UI.

## Global Constraints

- Use 2-space indent, semicolons, double quotes, trailing commas in multi-line literals (repo style).
- Tailwind class strings must appear as complete literals somewhere Tailwind scans (so the scale module holds the literal `"h-8"`/`"h-10"`/`"h-11"` strings).
- No new automated tests — the change is presentational (repo has `vitest` but these Tailwind-class changes have no meaningful unit surface). Verify via `pnpm typecheck`, `pnpm lint`, and a final `pnpm build` + visual check.
- The uniform toolbar height is **40px** (`md`). Do NOT alter these intentional compact deviations: `transfer-list.tsx` pane search (`<Input className="h-8">`) and the `solutions-directory.tsx` inline status-pill `Select` (`className="h-auto …"`).
- `Input`'s `auth` size (`h-[42px]`, auth screens) stays untouched.

---

## File Structure

- **Create** `src/components/ui/control-size.ts` — the height + min-height scale and `ControlSize` type. Single source of truth.
- **Modify** `src/components/ui/button.tsx` — heights sourced from the scale (values unchanged).
- **Modify** `src/components/ui/input.tsx` — default height sourced from the scale.
- **Modify** `src/components/ui/select.tsx` — add `size` + `aria-label` props; height from the scale.
- **Modify** `src/components/ui/segmented.tsx` — add `size`; `min-height` from the scale + vertical centering (no clipping of wrapped labels).
- **Rename + modify** `src/components/ui/admin-search-input.tsx` → `src/components/ui/search-input.tsx` — rename component to `SearchInput`, add `size` + `className` props, default height 40.
- **Modify** `src/features/users/components/people-directory.tsx` — import rename; toolbar button → `default`.
- **Modify** `src/features/groups/components/groups-directory.tsx` — import rename; toolbar button → `default`.
- **Modify** `src/features/solutions/components/solutions-directory.tsx` — toolbar `+ Add` button → `default`.
- **Modify** `src/features/themes/components/theme-builder.tsx` — top-row Delete/Save buttons → `default`.
- **Modify** `src/features/solutions-hub/components/solutions-hub.tsx` — replace bespoke search `<div>` with `SearchInput`, replace `SortSelect` with shared `Select`, delete `SortSelect`.

---

## Task 1: Shared control-size scale module

**Files:**
- Create: `src/components/ui/control-size.ts`

**Interfaces:**
- Produces: `CONTROL_HEIGHTS: Record<"sm"|"md"|"lg", string>` (`"h-8"|"h-10"|"h-11"`), `CONTROL_MIN_HEIGHTS: Record<"sm"|"md"|"lg", string>` (`"min-h-8"|"min-h-10"|"min-h-11"`), and `type ControlSize = "sm"|"md"|"lg"`.

- [ ] **Step 1: Create the module**

```ts
// Single source of truth for form-control heights (32 / 40 / 44). Every control
// derives its height from this scale so toolbars align. Values are full Tailwind
// class literals so the JIT scanner picks them up here.
export const CONTROL_HEIGHTS = { sm: "h-8", md: "h-10", lg: "h-11" } as const;

// min-height variants for controls whose content may wrap (e.g. SegmentedControl
// with long labels) — grow instead of clipping.
export const CONTROL_MIN_HEIGHTS = { sm: "min-h-8", md: "min-h-10", lg: "min-h-11" } as const;

export type ControlSize = keyof typeof CONTROL_HEIGHTS;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/control-size.ts
git commit -m "feat(ui): add shared control-height scale (genie-ops-center-cm6)"
```

---

## Task 2: Wire Button to the scale

**Files:**
- Modify: `src/components/ui/button.tsx:22-27`

**Interfaces:**
- Consumes: `CONTROL_HEIGHTS` from Task 1.
- Produces: no API change — `Button` size variants render identical heights (`sm`=32, `default`=40, `auth`=44, `icon`=40).

- [ ] **Step 1: Add the import**

At the top of `button.tsx`, after the existing imports, add:

```ts
import { CONTROL_HEIGHTS } from "./control-size";
```

- [ ] **Step 2: Source heights from the scale**

Replace the `size` block (currently):

```ts
      size: {
        default: "h-10 px-[18px]",
        sm: "h-8 px-3",
        auth: "h-11 px-[18px] text-title",
        icon: "size-10",
      },
```

with:

```ts
      size: {
        default: `${CONTROL_HEIGHTS.md} px-[18px]`,
        sm: `${CONTROL_HEIGHTS.sm} px-3`,
        auth: `${CONTROL_HEIGHTS.lg} px-[18px] text-title`,
        icon: "size-10",
      },
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "refactor(ui): source Button heights from control-size scale"
```

---

## Task 3: Wire Input to the scale

**Files:**
- Modify: `src/components/ui/input.tsx:17-19`

**Interfaces:**
- Consumes: `CONTROL_HEIGHTS` from Task 1.
- Produces: no API change — default Input stays 40px; `auth` stays `h-[42px]`.

- [ ] **Step 1: Add the import**

At the top of `input.tsx`, after the existing import, add:

```ts
import { CONTROL_HEIGHTS } from "./control-size";
```

- [ ] **Step 2: Source the default height from the scale**

Replace this line:

```ts
        inputSize === "auth" ? "h-[42px] text-title" : "h-10 text-body",
```

with:

```ts
        inputSize === "auth" ? "h-[42px] text-title" : `${CONTROL_HEIGHTS.md} text-body`,
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "refactor(ui): source Input default height from control-size scale"
```

---

## Task 4: Add `size` and `aria-label` to Select

**Files:**
- Modify: `src/components/ui/select.tsx`

**Interfaces:**
- Consumes: `CONTROL_HEIGHTS`, `ControlSize` from Task 1.
- Produces: `Select` gains optional `size?: ControlSize` (default `"md"`) and `"aria-label"?: string`. Height renders from the scale but a `className` height (e.g. `h-auto`) still overrides via `twMerge`. The hub (Task 9) relies on both new props.

- [ ] **Step 1: Add the import**

At the top of `select.tsx`, after the Base UI import, add:

```ts
import { CONTROL_HEIGHTS, type ControlSize } from "./control-size";
```

- [ ] **Step 2: Add the props to the signature**

In the destructured params add `size` and `ariaLabel`, and in the prop type add their types. Change the params list from:

```ts
  placeholder = "Select…",
  className,
  disabled,
  name,
  required,
  form,
}: {
```

to:

```ts
  placeholder = "Select…",
  className,
  disabled,
  name,
  required,
  form,
  size = "md",
  "aria-label": ariaLabel,
}: {
```

and in the type object, after `form?: string;`, add:

```ts
  size?: ControlSize;
  "aria-label"?: string;
```

- [ ] **Step 3: Apply height from the scale + forward aria-label**

In the `SelectPrimitive.Trigger`, replace the `className` line that starts with `"flex h-10 w-full ...` — change the leading `flex h-10 w-full` to use the scale, and add `aria-label` to the trigger. The `cn(...)` first argument currently begins:

```ts
          "flex h-10 w-full items-center justify-between gap-2 rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 font-sans text-body text-foreground outline-none transition-colors focus-visible:border-[var(--brand)] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-[var(--brand)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
```

Replace `h-10` in that string with `${CONTROL_HEIGHTS[size]}` (making it a template literal), i.e.:

```ts
          `flex ${CONTROL_HEIGHTS[size]} w-full items-center justify-between gap-2 rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 font-sans text-body text-foreground outline-none transition-colors focus-visible:border-[var(--brand)] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-[var(--brand)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`,
```

Then add `aria-label={ariaLabel}` as a prop on `SelectPrimitive.Trigger` (next to `data-slot="select-trigger"`):

```tsx
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        aria-label={ariaLabel}
        className={cn(
```

- [ ] **Step 4: Verify the status-pill override still wins**

Run: `pnpm typecheck`
Then confirm the inline status-pill Select is untouched and still uses `h-auto`:

Run: `rg -n "h-auto w-auto" src/features/solutions/components/solutions-directory.tsx`
Expected: still present at ~line 350 (its `className` overrides the new default via `twMerge` — no code change needed there).

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "feat(ui): add size + aria-label to Select, source height from scale"
```

---

## Task 5: SegmentedControl min-height + `size`

**Files:**
- Modify: `src/components/ui/segmented.tsx`

**Interfaces:**
- Consumes: `CONTROL_MIN_HEIGHTS`, `ControlSize` from Task 1.
- Produces: `SegmentedControl` gains optional `size?: ControlSize` (default `"md"`). Renders a **min-height** of 40px with segments vertically centered; long labels that wrap grow the control instead of clipping.

- [ ] **Step 1: Add the import**

At the top of `segmented.tsx`, after the `cn` import, add:

```ts
import { CONTROL_MIN_HEIGHTS, type ControlSize } from "./control-size";
```

- [ ] **Step 2: Add `size` to the signature**

Change the destructured params from:

```ts
function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}) {
```

to:

```ts
function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  disabled,
  size = "md",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  size?: ControlSize;
}) {
```

- [ ] **Step 3: Container → min-height + stretch**

Change the container `className` from:

```ts
      className={cn(
        "inline-flex rounded-none border border-[var(--line)] font-sans text-small font-semibold",
        disabled && "opacity-50",
        className,
      )}
```

to (adds `items-stretch` so segments fill the height, and the min-height from the scale):

```ts
      className={cn(
        "inline-flex items-stretch rounded-none border border-[var(--line)] font-sans text-small font-semibold",
        CONTROL_MIN_HEIGHTS[size],
        disabled && "opacity-50",
        className,
      )}
```

- [ ] **Step 4: Segments vertically center their label**

Change the segment button `className` first argument from:

```ts
              "px-3 py-2 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed",
```

to:

```ts
              "flex items-center justify-center px-3 py-2 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed",
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/segmented.tsx
git commit -m "feat(ui): give SegmentedControl a scale-based min-height (no label clipping)"
```

---

## Task 6: Rename AdminSearchInput → SearchInput (+ size, className)

**Files:**
- Rename: `src/components/ui/admin-search-input.tsx` → `src/components/ui/search-input.tsx`
- Modify (new file contents): `src/components/ui/search-input.tsx`
- Modify: `src/features/users/components/people-directory.tsx:13` (import)
- Modify: `src/features/groups/components/groups-directory.tsx:14` (import)

**Interfaces:**
- Consumes: `CONTROL_HEIGHTS`, `ControlSize` from Task 1; `cn` from `@/lib/utils`.
- Produces: `SearchInput` — same props as before plus `size?: ControlSize` (default `"md"` = 40px) and `className?: string` (merged onto the outer wrapper). Default width stays `w-[220px] max-w-[48vw]` but is overridable. The hub (Task 9) imports this.

- [ ] **Step 1: Rename the file via git**

```bash
git mv src/components/ui/admin-search-input.tsx src/components/ui/search-input.tsx
```

- [ ] **Step 2: Rewrite the component**

Replace the entire contents of `src/components/ui/search-input.tsx` with:

```tsx
import { cn } from "@/lib/utils";

import { CONTROL_HEIGHTS, type ControlSize } from "./control-size";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: ControlSize;
  className?: string;
  "aria-label"?: string;
};

/**
 * Bordered search composite — hairline border, circle-outline glyph, borderless
 * inner input. Height comes from the shared control scale (default 40px). Width
 * defaults to 220px but is overridable via `className`. Consumed by the
 * People / Groups admin toolbars and the workspace solutions hub.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  size = "md",
  className,
  ...props
}: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex w-[220px] max-w-[48vw] items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-[10px]",
        CONTROL_HEIGHTS[size],
        className,
      )}
    >
      <span
        aria-hidden
        className="size-[11px] shrink-0 rounded-full border-[1.5px] border-[var(--ink3)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-none bg-transparent font-sans text-small text-foreground outline-none placeholder:text-[var(--ink3)]"
        {...props}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update the People import**

In `src/features/users/components/people-directory.tsx`, change:

```ts
import { AdminSearchInput } from "@/components/ui/admin-search-input";
```

to:

```ts
import { SearchInput } from "@/components/ui/search-input";
```

Then update its single usage — change `<AdminSearchInput` to `<SearchInput` (around line 254).

- [ ] **Step 4: Update the Groups import**

In `src/features/groups/components/groups-directory.tsx`, change:

```ts
import { AdminSearchInput } from "@/components/ui/admin-search-input";
```

to:

```ts
import { SearchInput } from "@/components/ui/search-input";
```

Then update its single usage — change `<AdminSearchInput` to `<SearchInput` (around line 149).

- [ ] **Step 5: Confirm no stale references remain**

Run: `rg -n "AdminSearchInput|admin-search-input"`
Expected: no matches.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ui): rename AdminSearchInput -> SearchInput, 40px default, size+className"
```

---

## Task 7: Uniform 40px admin toolbar buttons

**Files:**
- Modify: `src/features/users/components/people-directory.tsx:268`
- Modify: `src/features/groups/components/groups-directory.tsx:155`
- Modify: `src/features/solutions/components/solutions-directory.tsx:110`

**Interfaces:**
- Consumes: `Button` (no API change).
- Produces: the People, Groups, and Solutions toolbar action buttons render at 40px, matching their sibling search/select controls.

- [ ] **Step 1: People `+ Add person` button → default**

In `people-directory.tsx`, the toolbar button (the one whose child text is `+ Add person`, around lines 266-273) — remove its `size="sm"` line so it uses the `default` (40px) size. Do NOT touch the `Manage` link button at line ~181 (that stays `size="sm"`). The button should read:

```tsx
          <Button
            variant="dark"
            className="px-[14px]"
            onClick={() => setInviteOpen(true)}
          >
            + Add person
          </Button>
```

- [ ] **Step 2: Groups `+ New group` button → default**

In `groups-directory.tsx` line 155, change:

```tsx
        <Button variant="dark" size="sm" className="px-[14px]" onClick={() => setCreateOpen(true)}>
```

to:

```tsx
        <Button variant="dark" className="px-[14px]" onClick={() => setCreateOpen(true)}>
```

- [ ] **Step 3: Solutions `+ Add` button → default**

In `solutions-directory.tsx`, the header button (around lines 108-115) — remove its `size="sm"` line. It should read:

```tsx
        <Button
          variant="dark"
          className="px-[14px]"
          onClick={() => setRegisterOpen(true)}
        >
          + Add
        </Button>
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/users/components/people-directory.tsx src/features/groups/components/groups-directory.tsx src/features/solutions/components/solutions-directory.tsx
git commit -m "fix(admin): uniform 40px toolbar action buttons"
```

---

## Task 8: Theme-builder top-row buttons → 40px

**Files:**
- Modify: `src/features/themes/components/theme-builder.tsx:272-283`

**Interfaces:**
- Consumes: `Button` (no API change).
- Produces: the Delete / Save changes buttons align with the 40px theme-name `Input` in the same row.

- [ ] **Step 1: Delete button → default**

In `theme-builder.tsx`, the Delete button (around lines 272-279) — remove its `size="sm"` line:

```tsx
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={deleteTheme.isPending}
          >
            Delete
          </Button>
```

- [ ] **Step 2: Save button → default**

Change line 281 from:

```tsx
          <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
```

to:

```tsx
          <Button type="submit" disabled={isSubmitting || !isDirty}>
```

Leave every other `size="sm"` button in this file unchanged (the element-editor add/remove buttons are single-type clusters, out of scope).

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/themes/components/theme-builder.tsx
git commit -m "fix(themes): align theme-builder top-row buttons to 40px"
```

---

## Task 9: Migrate the workspace hub toolbar onto shared primitives

**Files:**
- Modify: `src/features/solutions-hub/components/solutions-hub.tsx`

**Interfaces:**
- Consumes: `SearchInput` (Task 6), `Select` with `aria-label` (Task 4), `SegmentedControl` (Task 5, now 40px via the scale).
- Produces: the hub toolbar's search, segmented, and sort controls all render at 40px. The bespoke `SortSelect` component is removed.

- [ ] **Step 1: Add the imports**

At the top of `solutions-hub.tsx`, in the `@/components/ui/*` import group (next to the `SegmentedControl` import), add:

```ts
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
```

- [ ] **Step 2: Replace the bespoke search box**

Replace the entire search `<div>` block (the `<div style={{ flex: 1, maxWidth: 300, height: 34, ... }}>` containing the circle `<span>` and the borderless `<input>` — approximately lines 119-156) with:

```tsx
            <SearchInput
              value={search}
              onChange={(v) => resetLimit(() => setSearch(v))}
              placeholder="Search solutions…"
              aria-label="Search solutions"
              className="flex-1 max-w-[300px]"
            />
```

- [ ] **Step 3: Replace the SortSelect usage**

Replace the `<SortSelect ... />` line (around line 163):

```tsx
            <SortSelect value={sort} onChange={(v) => resetLimit(() => setSort(v))} />
```

with:

```tsx
            <Select
              items={SORTS}
              value={sort}
              onValueChange={(v) => resetLimit(() => setSort(v as HubSort))}
              aria-label="Sort solutions"
              className="w-[200px]"
            />
```

- [ ] **Step 4: Delete the now-unused SortSelect component**

Remove the entire `function SortSelect(...) { ... }` definition (approximately lines 253-296 — the whole function, from `function SortSelect` through its closing `}`).

- [ ] **Step 5: Confirm nothing else references SortSelect**

Run: `rg -n "SortSelect" src/features/solutions-hub/components/solutions-hub.tsx`
Expected: no matches.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS (lint would flag `SORTS` as unused if the Select wiring is wrong — it must still be referenced by `items={SORTS}`).

- [ ] **Step 7: Commit**

```bash
git add src/features/solutions-hub/components/solutions-hub.tsx
git commit -m "refactor(hub): migrate toolbar to shared SearchInput/Select (uniform 40px)"
```

---

## Task 10: Full-app verification

**Files:** none (verification only).

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: build succeeds with no type or lint errors. (Per project note, prefer `pnpm build` over `next dev` for verification.)

- [ ] **Step 2: Visual sweep**

Start the app and confirm every control row has equal-height (40px) members:
- `/admin/people` — search, sort Select, `+ Add person` all 40px.
- `/admin/groups` — search + `+ New group` all 40px.
- `/admin/solutions` — search Input, segmented, sort Select, `+ Add` all 40px.
- `/admin/themes/[id]` — theme-name Input + Delete/Save all 40px; segmented tab controls 40px.
- `/admin/groups/access` — "Who can open a solution?" / "What can a person open?" segmented is 40px and its long labels do NOT clip (check a narrow viewport — it should grow, not cut off).
- `/` (workspace home hub) — search, type segmented, sort Select all 40px and aligned.

- [ ] **Step 3: Confirm intentional deviations survived**

Verify these did NOT get bumped to 40px:
- Access Grants panel / group members transfer-list pane search stays compact (32px).
- Solutions table inline status pill stays a small pill (not 40px).

- [ ] **Step 4: Close the issue**

```bash
bd close genie-ops-center-cm6 --reason="Shared control-height scale; all toolbars uniform 40px"
```

---

## Self-Review Notes

- **Spec coverage:** scale module (T1) · Button/Input/Select/Segmented/SearchInput wiring (T2-T6) · People/Groups/Solutions toolbars (T7) · theme-builder row (T8) · hub migration (T9) · verification incl. deviations (T10). All spec sections mapped.
- **Segmented clip risk** handled via `CONTROL_MIN_HEIGHTS` + `items-stretch` + centered segments (T5), verified in T10 Step 2.
- **Intentional deviations** (`transfer-list` `h-8` Input, status-pill `h-auto` Select) preserved by `twMerge` override behavior; explicitly re-verified in T4 Step 4 and T10 Step 3.
- **Rename** touches exactly the two admin import sites; T6 Step 5 greps to prove no stragglers.
- **a11y:** hub Select keeps its `Sort solutions` label via the new `aria-label` prop (T4/T9).
