# Theme Builder — Selected States + Theme Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invisible Tabs selected state and the too-subtle preset-card selected state in the admin Theme Builder, and surface the theme name as an always-visible, always-editable header field.

**Architecture:** Three self-contained UI edits — one to the shared `Tabs` component, two to `theme-builder.tsx`. Selection styling switches to the attributes base-ui actually emits (`aria-selected`) and to the app's canonical selected-card recipe (brand border + `--brandtint` fill). The theme name `<Input>` and Delete button move from inside the Elements tab into the editor header row. No data-model, tRPC, or schema changes.

**Tech Stack:** Next.js (App Router) + React 19, TypeScript, Tailwind v4 (arbitrary CSS-var utilities), base-ui `@base-ui/react` 1.6.0, react-hook-form + zod. Design tokens in `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-07-03-theme-builder-selected-state-and-naming-design.md`

## Global Constraints

- TypeScript for all code; 2-space indent, semicolons, double quotes, trailing commas in multi-line literals.
- Never hard-code px font sizes — use existing components/utilities (`text-small`, the `Button`/`Input` primitives) which map to the `--t-*` scale.
- Brand blue (`--brand`) stays reserved for primary + selection/focus. Selected surfaces use `--brandtint`; strong ink fill (`--ink` / `--on-ink`) is the segmented-control/tabs recipe.
- No database, Drizzle schema, migration, or tRPC changes. `theme.config.preset` and `theme.name` already exist.
- Verification for every task: `pnpm typecheck` and `pnpm lint` pass, plus a browser check via `verdict` in **both light and dark** (toggle with the header "Toggle theme" button). There is no unit-test runner in this repo — do **not** add one.
- Dev server runs at `http://localhost:3000`; `/admin/themes` requires an admin session (already established in this environment; if a task starts fresh and it 307-redirects to login, run `pnpm reset-admin` and sign in).

---

### Task 1: Fix Tabs selected state (shared component)

The selected `Tabs.Tab` is styled with `data-[selected]:…`, but base-ui's `Tabs.Tab` (built on `useCompositeItem`) emits `aria-selected="true"` and `data-active`, never `data-selected`. So the active tab renders identically to the others. Switch to `aria-selected:` and guard hover so the selected tab keeps its ink fill on hover.

**Files:**
- Modify: `src/components/ui/tabs.tsx` (the `TabsTab` component, ~lines 28-39)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (public API of `TabsTab` is unchanged; only its class list changes).

- [ ] **Step 1: Apply the class-list change**

In `src/components/ui/tabs.tsx`, replace the `TabsTab` `className` string.

From:

```tsx
      className={cn(
        "cursor-pointer px-4 py-2 text-[var(--ink2)] outline-none transition-colors duration-150 hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[selected]:bg-[var(--ink)] data-[selected]:text-[var(--on-ink)]",
        className,
      )}
```

To:

```tsx
      className={cn(
        "cursor-pointer px-4 py-2 text-[var(--ink2)] outline-none transition-colors duration-150 hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-selected:bg-[var(--ink)] aria-selected:text-[var(--on-ink)] aria-selected:hover:bg-[var(--ink)]",
        className,
      )}
```

Why `aria-selected:hover:bg-[var(--ink)]`: the compound `[aria-selected="true"]:hover` selector (specificity 0,2,0) beats the plain `hover:bg-[var(--panel)]` (0,1,0), so hovering the active tab keeps the ink fill instead of flipping to grey — regardless of Tailwind's variant source order.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass, no errors.

- [ ] **Step 3: Browser verification (light + dark)**

Ensure the dev server is running (`pnpm dev` if not). Then:

```bash
verdict goto "http://localhost:3000/admin/themes"
verdict snapshot -i          # confirm tabs "Presets"/"Elements"/"Custom CSS" are present
verdict screenshot /tmp/t1-tabs-light.png
```

Verify in `/tmp/t1-tabs-light.png`: the selected tab (e.g. "Presets") now has a **dark ink fill with white text**; the other two are transparent with grey text. Click "Elements" (`verdict click @<elements-id>`) and re-screenshot — the fill should follow the active tab. Hover an inactive tab → panel grey; hover the active tab → stays dark (not grey).

Then toggle dark mode and repeat:

```bash
verdict snapshot -i          # find the "Toggle theme" button
verdict click @<toggle-theme-id>
verdict screenshot /tmp/t1-tabs-dark.png
```

Verify the same behavior holds in dark mode (ink fill flips per tokens, active tab clearly filled). Toggle back to light when done.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tabs.tsx
git commit -m "fix(ui): tabs selected state uses aria-selected (base-ui emits no data-selected)"
```

---

### Task 2: Strengthen preset-card selected state

The selected preset card renders only a 1px brand border + 1px ring — far subtler than the app's selected language. Replace it with the `ThemeChip` recipe: brand border + `--brandtint` fill, with a hover guard so the tint holds while hovering the selected card.

**Files:**
- Modify: `src/features/themes/components/theme-builder.tsx` (the preset `<button>` inside the `presets` `TabsPanel`, ~lines 286-304)

**Interfaces:**
- Consumes: existing `config.preset`, `applyPreset(preset)`, `THEME_PRESETS` (all already in scope).
- Produces: nothing new.

- [ ] **Step 1: Apply the class-list change**

In `src/features/themes/components/theme-builder.tsx`, update the preset button's `className`.

From:

```tsx
                      className="flex flex-1 min-w-[118px] flex-col items-start gap-2 border border-[var(--line)] p-3 text-left outline-none transition-colors hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-[var(--brand)] data-[active=true]:ring-1 data-[active=true]:ring-[var(--brand)]"
```

To:

```tsx
                      className="flex flex-1 min-w-[118px] flex-col items-start gap-2 border border-[var(--line)] bg-[var(--surface)] p-3 text-left outline-none transition-colors hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-[var(--brand)] data-[active=true]:bg-[var(--brandtint)] data-[active=true]:hover:bg-[var(--brandtint)]"
```

Changes: added explicit `bg-[var(--surface)]` idle background; removed `data-[active=true]:ring-1 data-[active=true]:ring-[var(--brand)]`; added `data-[active=true]:bg-[var(--brandtint)]` (tint fill) and `data-[active=true]:hover:bg-[var(--brandtint)]` (hover guard). `data-active={config.preset === preset.id}` and everything else stay as-is. The label (`text-foreground`) and description (`text-[var(--ink3)]`) remain legible on the pale tint.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 3: Browser verification (light + dark)**

```bash
verdict goto "http://localhost:3000/admin/themes"
verdict snapshot -i          # find the four preset cards (Default/Midnight/Meadow/Classic)
verdict click @<midnight-preset-id>
verdict screenshot /tmp/t2-preset-light.png
```

Verify in `/tmp/t2-preset-light.png`: the clicked preset card shows a **brand-blue border + pale-blue (`--brandtint`) fill**; the others show the plain surface/line border. Exactly one card is filled at a time. Hover an unselected card → panel grey; hover the selected card → keeps the tint. Then click "Save changes", reload the page, and confirm the same card is still shown selected (persisted via `config.preset`).

Toggle dark mode (header "Toggle theme"), re-select, and screenshot `/tmp/t2-preset-dark.png` — the selected card uses the dark `--brandtint` (#1c2738) with a readable brand border. Toggle back to light.

- [ ] **Step 4: Commit**

```bash
git add src/features/themes/components/theme-builder.tsx
git commit -m "fix(admin-themes): stronger preset-card selected state (brand border + tint)"
```

---

### Task 3: Promote theme name + Delete into the editor header row

The name `<Input>` and Delete button live inside the Elements tab, so there is no way to name a theme right after picking a preset. Move both into the always-visible editor header row (alongside Save changes) and remove them from the Elements panel. After this task, all three changes are in place — this task's verification is also the full acceptance pass.

**Files:**
- Modify: `src/features/themes/components/theme-builder.tsx` (`ThemeBuilderEditor`: the header row ~lines 260-266, and the Elements `TabsPanel` name block ~lines 312-327)

**Interfaces:**
- Consumes: existing `ThemeBuilderEditor` form state — `register`, `errors`, `isSubmitting`, `isDirty`, `handleDelete`, `deleteTheme.isPending`, `onSubmit` (all already defined in the component).
- Produces: nothing new.

- [ ] **Step 1: Replace the header row (add name Input + Delete + Save)**

In `ThemeBuilderEditor`, replace the current header block.

From:

```tsx
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <FormError message={errors.root?.message} />
```

To:

```tsx
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <Input id="theme-name" {...register("name")} placeholder="Theme name" />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={deleteTheme.isPending}
          >
            Delete
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
      <FormError message={errors.root?.message} />
```

- [ ] **Step 2: Remove the name + Delete block from the Elements panel**

Still in `theme-builder.tsx`, delete the name/Delete block at the top of the `elements` `TabsPanel` so the panel leads with the first `SwatchField`.

From:

```tsx
              <TabsPanel value="elements" className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input id="theme-name" {...register("name")} placeholder="Theme name" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete()}
                      disabled={deleteTheme.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                  <FieldError message={errors.name?.message} />
                </div>

                <SwatchField
                  label="Header & accent"
```

To:

```tsx
              <TabsPanel value="elements" className="flex flex-col gap-5">
                <SwatchField
                  label="Header & accent"
```

There must now be exactly **one** `id="theme-name"` in the file (the one in the header). Confirm with: `grep -n 'id="theme-name"' src/features/themes/components/theme-builder.tsx` → single match.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass (no unused-import/variable warnings — `Input`, `Button`, `FieldError`, `handleDelete`, `deleteTheme` are all still used).

- [ ] **Step 4: Full acceptance verification (light + dark)**

```bash
verdict goto "http://localhost:3000/admin/themes"
verdict screenshot /tmp/t3-elements-header.png
```

Verify:
- The **theme name field + Delete + Save changes** appear in the top header row and are visible on the **Presets**, **Elements**, and **Custom CSS** tabs (click each; the header stays put). The Elements tab now starts with "Header & accent" swatches (no duplicate name field).
- Edit the name, click **Save changes**, reload → the new name persists (and shows in the Saved-themes chip strip and the live preview).
- Click **"+ New theme"** → lands on a theme named "New theme" with the name field immediately visible/editable in the header.
- **Delete** from the header still works (opens the confirm dialog; on confirm, routes to another theme or the empty state).
- Re-confirm Task 1 (tabs ink fill) and Task 2 (preset card brand-tint) still render correctly now that layout changed.

Toggle dark mode and repeat the visual spot-checks; screenshot `/tmp/t3-dark.png`. Toggle back to light.

- [ ] **Step 5: Commit**

```bash
git add src/features/themes/components/theme-builder.tsx
git commit -m "feat(admin-themes): always-visible theme name + Delete in editor header"
```

---

## Self-Review

**Spec coverage:**
- Issue #1 Tabs bug → Task 1. ✅
- Issue #1 preset card weakness (Option A) → Task 2. ✅
- Issue #2 name discoverability (Layout A) → Task 3. ✅
- "Not affected" components (SegmentedControl, ThemeChip, Select) → untouched by design. ✅
- Non-goals (auto-name from preset, unique-name enforcement, auto-focus on create) → intentionally not in any task. ✅
- Verification (typecheck, lint, verdict light+dark) → in every task; full acceptance pass in Task 3. ✅

**Placeholder scan:** No TBD/TODO; every code step shows exact before/after strings and JSX. ✅

**Type/consistency:** No new symbols introduced; all consumed identifiers (`register`, `errors`, `handleDelete`, `deleteTheme`, `config.preset`, `applyPreset`) already exist in the touched components. Single `id="theme-name"` after Task 3. ✅
