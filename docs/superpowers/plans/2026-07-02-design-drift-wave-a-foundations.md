# Design Drift Remediation — Wave A (Foundations & Tokens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the cross-cutting root causes of design drift — switch the font system to Archivo + Hanken Grotesk + IBM Plex Mono, fix the solutions-hub CSS (breakpoint + padding ladder), add per-solution color theming, introduce a `Chip` primitive, and correct the token/UI-kit sizes that are off across every surface.

**Architecture:** This is Wave A of a 3-wave remediation (spec: `docs/superpowers/specs/2026-07-02-design-drift-remediation-design.md`). It touches only foundations: `globals.css` tokens, `next/font` loading, the solutions table schema (two nullable accent-color columns), the solutions hub/grid CSS, and shared UI-kit primitives (`Button`, `Input`, `StatusBadge`, `Table`, `Skeleton`, plus a new `Chip`). It deliberately does **not** touch admin forms, the configure modal, or themes — those are Wave C. The per-solution theming is opt-in (nullable columns default null → components fall back to neutral `--panel`/`--ink`), so Wave A ships safely even before Wave B/C consume the new colors.

**Tech Stack:** Next.js 16 (app router) · Tailwind v4 + shadcn on Base UI · `next/font/google` · Drizzle ORM + drizzle-kit (Postgres) · `class-variance-authority` · `oxlint`/`oxfmt` · tRPC + zod. **No unit-test runner is configured** — the project's verification cycle is `pnpm typecheck` + `pnpm lint` + visual checks. Every task uses that cycle (not a hypothetical test framework).

## Global Constraints

- **Fonts:** prototype source of truth is **Archivo** (wt 500/600/700/800, display/headings/initials/avatars), **Hanken Grotesk** (wt 400/500/600/700, UI/body/inputs), **IBM Plex Mono** (wt 400/500/600, labels/data). Loaded via `next/font/google`; never a `<link>` to Google Fonts in the document head.
- **Family token map:** `--font-display` → Archivo; `--font-ui` → Hanken Grotesk; `--font-mono` → IBM Plex Mono.
- **No hard-coded px font sizes** in components — always a `--t-*` / `--m-*` token (responsive). Radius stays 0–3px (pills 11px for toggles only). Brand `#2360c4` only for primary action + selection + focus ring.
- **Code style:** 2-space indent, semicolons, double quotes, trailing commas in multi-line objects/arrays (project CLAUDE.md).
- **DB migrations:** generated with `pnpm db:generate`, applied with `pnpm db:migrate`. The dev DB runs via `pnpm db:dev` (Docker) at `postgres://genie:genie@localhost:5432/genie`.
- **Verification per task:** `pnpm typecheck && pnpm lint` must pass; then `pnpm dev` + visual check against the prototype at 920px / 1180px / 1440px viewports using `verdict`.
- **Commit often:** one commit per task (or per logical step within a task). Conventional-commit messages (`fix(ui):`, `feat(hub):`, `chore(db):`, etc.).

---

## File Structure

**Modified:**
- `src/app/layout.tsx` — swap `next/font` imports to Archivo/Hanken_Grotesk/IBM_Plex_Mono; expose CSS variables.
- `src/app/globals.css` — remap `--font-display`/`--font-ui`/`--font-mono`; fix `--chrome` dark value; define `.cs-hubpad` ladder; change hub table breakpoint 960→920px; add `@keyframes csShimmer`; add `--panel-chat` token.
- `src/server/db/schema.ts` — add `accentColor` + `accentColorInvert` nullable text columns on `solution`.
- `src/features/solutions/schemas/solution.ts` — extend `Solution` row type + `monogram` seeding hooks to carry accent colors.
- `src/components/ui/button.tsx` — fix hover (`brightness` not `opacity`); add `size: "auth"`.
- `src/components/ui/input.tsx` — add optional `inputSize` prop incl. `"auth"` (42px, `--t-title`).
- `src/components/ui/status-badge.tsx` — size to `--m-xs`, padding `3px 7px`, remove dot `gap`.
- `src/components/ui/table.tsx` — header `text-mono-xs` + padding `12px 16px`; cell padding `16px` vertical.
- `src/components/ui/skeleton.tsx` — `animate-pulse` → custom `csShimmer` keyframe class.
- `src/components/ui/slide-over.tsx` — scrim `0.32` → `0.45`.
- `src/features/solutions-hub/components/solution-row.tsx` — consume per-solution accent colors on the mono tile (fallback neutral).
- `src/features/solutions-hub/components/solutions-hub.tsx` — side-rail tile accent colors; apply `.cs-hubpad` to the hub content wrappers.
- `src/features/solution-viewer/components/chat-slot.tsx` — header background uses per-solution accent (fallback brand).
- `src/features/chat/components/chat-conversation.tsx` + `src/components/ai-elements/message.tsx` + `prompt-input.tsx` — consume accent where prototype does (avatar/user-bubble/send), with fallbacks.

**Created:**
- `src/components/ui/chip.tsx` — new `Chip` primitive (mixed-case sans, 1px line border, 2px radius, optional ellipsis).
- `drizzle/0003_solution_accent.sql` — generated migration for the two new columns.

**Not in Wave A** (Wave B/C): auth control sizing consumption, auth banner glyphs, SOC2 footer, hub rail `· updated` + Fullscreen tip card, account trusted-devices card, all admin form/table-rebuild work, configure modal, themes editor.

---

## Task 1: Switch the font system to Archivo + Hanken Grotesk + IBM Plex Mono

**Resolves:** XF-01 (and is the foundation for WS-04, AU font drift, admin chrome font drift).

**Files:**
- Modify: `src/app/layout.tsx:2,8-16,21-23`

**Interfaces:**
- Produces: the CSS variables `--font-archivo`, `--font-hanken`, `--font-plex-mono` on `<html>`, consumed by Task 2's token remap. (Task 2 is what makes components actually render in the new fonts.)

- [ ] **Step 1: Replace the `next/font` imports and variables**

In `src/app/layout.tsx`, replace the import block and the two font definitions. Current code (lines 2, 8–16):

```tsx
import { Geist, Geist_Mono } from "next/font/google";
...
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Replace with:

```tsx
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
```

Then update the `<html>` className (currently line 21-23):

```tsx
className={`${archivo.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS (no errors). If `next/font/google` can't resolve a weight string, double-check the weight array matches Google Fonts' available weights for that family.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(fonts): load Archivo, Hanken Grotesk, IBM Plex Mono via next/font"
```

---

## Task 2: Remap the family tokens + fix `--chrome` dark value

**Resolves:** XF-01 (completes the font switch), XF-03.

**Files:**
- Modify: `src/app/globals.css:78-80` (font token map) and `src/app/globals.css:61` (`--chrome` dark).

**Interfaces:**
- Consumes: the `--font-archivo` / `--font-hanken` / `--font-plex-mono` variables from Task 1.
- Produces: `--font-display` → Archivo, `--font-ui` → Hanken Grotesk, `--font-mono` → IBM Plex Mono. Every component using `font-display`/`font-ui`/`font-mono` (and Tailwind `font-sans`/`font-mono` via `@theme inline`) now renders in the new families.

- [ ] **Step 1: Remap the three family tokens**

In `src/app/globals.css`, the typography `:root` block currently (lines 78-80):

```css
  --font-display: var(--font-geist-sans), system-ui, sans-serif;
  --font-ui: var(--font-geist-sans), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
```

Replace with:

```css
  --font-display: var(--font-archivo), system-ui, sans-serif;
  --font-ui: var(--font-hanken), system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;
```

- [ ] **Step 2: Update the `@theme inline` Tailwind alias**

The `@theme inline` block (around line 288) currently maps `--font-sans` and `--font-mono` to the geist variables:

```css
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-geist-sans);
```

Replace with:

```css
  --font-sans: var(--font-hanken);
  --font-mono: var(--font-plex-mono);
  --font-heading: var(--font-archivo);
```

(`font-sans` is the body/UI default → Hanken; `font-heading`/display → Archivo; `font-mono` → Plex Mono. This keeps the shadcn bridge and `@apply font-sans` in the base layer pointing at the right families.)

- [ ] **Step 3: Fix `--chrome` dark-mode value**

In the `[data-theme="dark"]` block, line 61 currently:

```css
  --chrome: #e7ecf3;
```

Replace with:

```css
  --chrome: #0f1319;
```

(matches `tokens/colors.css:54`).

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Visual check**

Run: `pnpm dev`, open http://localhost:3000.
Use `verdict goto http://localhost:3000` then `verdict snapshot -i`.
Confirm: headings/wordmark render in Archivo (slightly narrower, tighter), body/inputs in Hanken Grotesk, mono labels in IBM Plex Mono. Compare side-by-side with the prototype (`/tmp/genie-design/Genie Control Station.dc.html` opened in a browser).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(tokens): remap font families to Archivo/Hanken/Plex; fix --chrome dark value"
```

---

## Task 3: Add per-solution accent-color columns (data model)

**Resolves the data dependency for:** HB-03, HB-04, VW-01 (the color is consumed in Tasks 8–10).

**Files:**
- Modify: `src/server/db/schema.ts:59-78` (the `solution` table).
- Create: `drizzle/0003_solution_accent.sql` (generated).

**Interfaces:**
- Produces: `solution.accentColor` and `solution.accentColorInvert` — nullable `text` columns. `null` means "use neutral `--panel`/`--ink`" (the current behavior), so nothing breaks before Wave B/C surfaces adopt them. A hex string like `#2360c4` means "use this as the tile/header/bubble background, with `accentColorInvert` as the foreground."

- [ ] **Step 1: Add the two columns to the `solution` table**

In `src/server/db/schema.ts`, inside the `solution = pgTable("solution", { ... })` definition, add the columns immediately after `monogram` (after line 68). Current:

```ts
  monogram: text("monogram"), // e.g. "PT"
  archived: boolean("archived").notNull().default(false),
```

Replace with:

```ts
  monogram: text("monogram"), // e.g. "PT"
  // Per-solution brand color (Wave A theming). null = neutral (--panel/--ink);
  // a hex string tints the hub mono tile, side-rail tile, and chat header/
  // avatar/bubbles/send button. accentColorInvert is the on-accent foreground.
  accentColor: text("accent_color"),
  accentColorInvert: text("accent_color_invert"),
  archived: boolean("archived").notNull().default(false),
```

- [ ] **Step 2: Generate the migration**

Ensure the dev DB is running: `pnpm db:dev`.
Run: `pnpm db:generate`
Expected: drizzle-kit prints a new migration adding the two nullable columns. Confirm the generated `drizzle/0003_*.sql` contains two `ALTER TABLE "solution" ADD COLUMN` statements for `accent_color` and `accent_color_invert` (both nullable, no default). If drizzle names it differently, that's fine — note the actual filename.

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration applies cleanly. Verify with `pnpm db:studio` (open the `solution` table — the two new columns appear, null for existing rows) or `psql` — but `db:studio` is sufficient.

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add nullable accent_color / accent_color_invert to solution"
```

---

## Task 4: Carry accent colors through the Solution row type + queries

**Resolves:** the type/ plumbing for HB-03/HB-04/VW-01.

**Files:**
- Modify: `src/features/solutions/schemas/solution.ts` (the `Solution` row type, around line 170).
- Modify: the query that builds the hub list and the solution detail — locate via `grep -rn "monogram" src/features/solutions-hub src/features/solution-viewer src/features/solutions` to find every SELECT/mapper that includes `monogram` and add the two new columns alongside it.

**Interfaces:**
- Produces: `Solution.accentColor: string | null` and `Solution.accentColorInvert: string | null`. The hub list row and the viewer's resolved solution both carry them.

- [ ] **Step 1: Extend the `Solution` row type**

In `src/features/solutions/schemas/solution.ts`, the `Solution` type (end of file) currently:

```ts
export type Solution = {
  id: string;
  name: string;
  slug: string;
  type: SolutionType;
  status: SolutionStatus;
  description: string | null;
  monogram: string | null;
  archived: boolean;
  themeId: string | null;
  themeName: string | null;
  config: ChatConfig | EmbeddedConfig | NativeConfig;
  createdAt: string;
  updatedAt: string;
};
```

Add the two fields after `monogram`:

```ts
  monogram: string | null;
  accentColor: string | null;
  accentColorInvert: string | null;
  archived: boolean;
```

- [ ] **Step 2: Surface the columns in every mapper/SELECT**

Find each place that maps a DB row to a `Solution` (or hub/viewer row) and includes `monogram`:

```bash
grep -rn "monogram" src/features/solutions-hub src/features/solution-viewer src/features/solutions src/features/themes
```

For every mapper function hit, add the two columns to the Drizzle select and the returned object, e.g. where you see:

```ts
monogram: s.monogram,
```

add immediately after:

```ts
monogram: s.monogram,
accentColor: s.accentColor,
accentColorInvert: s.accentColorInvert,
```

If a query uses `select({ ... })` with an explicit column list, add `accentColor: s.accentColor` and `accentColorInvert: s.accentColorInvert` to that list. If it uses an unqualified table select (no explicit columns), no change is needed there — the columns come through automatically and only the mapper object needs the two keys.

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. TypeScript will error if any mapper returns the `Solution` type without the new fields — that's the safety net catching missed mappers. Fix each error by adding the two keys.

- [ ] **Step 4: Commit**

```bash
git add src/features/
git commit -m "feat(solutions): surface accentColor/accentColorInvert on Solution rows"
```

---

## Task 5: Solutions-hub CSS — breakpoint 960→920px + `.cs-hubpad` ladder

**Resolves:** HB-01, HB-02.

**Files:**
- Modify: `src/app/globals.css` — the `.cs-thead`/`.cs-trow`/`.cs-hide` media query (currently `@media (min-width: 960px)`, around line 478) and add the `.cs-hubpad` rules.

**Interfaces:**
- Consumes: `.cs-hubpad` className (already applied on hub wrappers in `solutions-hub.tsx:106` etc. — confirm with `grep -n "cs-hubpad" src/features/solutions-hub`).
- Produces: hub table flips to the grid layout at 920px (not 960px); hub content padding scales 24px → `34px 40px` → `40px 52px` → `48px 64px` → `60px 80px`.

- [ ] **Step 1: Change the breakpoint**

In `src/app/globals.css`, find the hub table media query:

```css
@media (min-width: 960px) {
  .cs-thead {
    display: grid;
  }
  .cs-trow {
    display: grid;
    grid-template-columns: 2.4fr 0.8fr 0.8fr 0.6fr 40px;
  }
  .cs-hide {
    display: block;
  }
}
```

Change `960px` → `920px`:

```css
@media (min-width: 920px) {
  .cs-thead {
    display: grid;
  }
  .cs-trow {
    display: grid;
    grid-template-columns: 2.4fr 0.8fr 0.8fr 0.6fr 40px;
  }
  .cs-hide {
    display: block;
  }
}
```

- [ ] **Step 2: Add the `.cs-hubpad` padding ladder**

In the same hub block of `globals.css` (just before the `.cs-hubgrid` rule is a good spot), add:

```css
/* Hub content padding ladder (prototype .cs-hubpad). Mobile-first 24px;
   scales up at each tier so wide screens breathe instead of hugging edges. */
.cs-hubpad {
  padding: 24px;
}
@media (min-width: 920px) {
  .cs-hubpad {
    padding: 34px 40px;
  }
}
@media (min-width: 1440px) {
  .cs-hubpad {
    padding: 40px 52px;
  }
}
@media (min-width: 1920px) {
  .cs-hubpad {
    padding: 48px 64px;
  }
}
@media (min-width: 2560px) {
  .cs-hubpad {
    padding: 60px 80px;
  }
}
```

- [ ] **Step 3: Confirm `.cs-hubpad` is applied on the hub wrappers**

Run: `grep -n "cs-hubpad" src/features/solutions-hub`
Expected: matches on the hub content containers (e.g. `solutions-hub.tsx`). If any hub wrapper sets an inline `style={{ padding: 24 }}` that would override the class, remove that inline style so the class ladder wins. (Audit note: `solutions-hub.tsx:107` had `style={{ padding: 24 }}` — remove it and rely on the class.)

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Visual check at three viewports**

Run: `pnpm dev`.
- `verdict goto http://localhost:3000` (the hub is the workspace home).
- Resize / check at **920px**: the table grid + header row + UPDATED column now appear (previously appeared at 960px).
- Check at **1180px**: two-column hub (list + side rail).
- Check at **1440px**: hub padding is now `40px 52px` (generous), not stuck at 24px.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/features/solutions-hub
git commit -m "fix(hub): table breakpoint 960->920px; add .cs-hubpad responsive padding ladder"
```

---

## Task 6: Skeleton shimmer keyframe + slide-over scrim weight

**Resolves:** XF-08, XF-10.

**Files:**
- Modify: `src/app/globals.css` (add `@keyframes csShimmer` + a `.cs-shimmer` utility).
- Modify: `src/components/ui/skeleton.tsx:9` (use the new class).
- Modify: `src/components/ui/slide-over.tsx:16` (scrim `0.32` → `0.45`).

**Interfaces:** none external — internal polish.

- [ ] **Step 1: Add the shimmer keyframe + utility class**

In `src/app/globals.css`, near the existing `.csSpin` keyframe (around line 352), add:

```css
/* Skeleton shimmer (prototype @keyframes csShimmer) — opacity .45↔.9 over 1.1s.
   Honors prefers-reduced-motion via the global reset below. */
@keyframes csShimmer {
  0% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    opacity: 0.45;
  }
}
.cs-shimmer {
  animation: csShimmer 1.1s ease-in-out infinite;
}
```

- [ ] **Step 2: Use the shimmer class in `Skeleton`**

In `src/components/ui/skeleton.tsx`, the `Skeleton` function (line 9) currently:

```tsx
      className={cn("h-3 animate-pulse rounded-none bg-[var(--line2)]", className)}
```

Replace `animate-pulse` with `cs-shimmer`:

```tsx
      className={cn("h-3 cs-shimmer rounded-none bg-[var(--line2)]", className)}
```

- [ ] **Step 3: Fix the slide-over scrim**

In `src/components/ui/slide-over.tsx` line 16, the `Backdrop` className currently:

```tsx
      className="fixed inset-0 z-50 bg-[rgba(8,10,14,0.32)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
```

Change `0.32` → `0.45`:

```tsx
      className="fixed inset-0 z-50 bg-[rgba(8,10,14,0.45)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui/skeleton.tsx src/components/ui/slide-over.tsx
git commit -m "fix(ui): custom skeleton shimmer keyframe; slide-over scrim 0.32->0.45"
```

---

## Task 7: `StatusBadge` size/padding + `Table` header/cell sizing + card-title tracking

**Resolves:** XF-04, XF-05, XF-06, XF-07, and the table padding drift (XF group).

**Files:**
- Modify: `src/components/ui/status-badge.tsx:8` (the `badgeVariants` base class).
- Modify: `src/components/ui/table.tsx:52` (`TableHead`) and `:64` (`TableCell`).
- Modify: `src/components/ui/card.tsx` (`CardTitle`), `src/components/ui/dialog.tsx` (`DialogTitle`), `src/components/ui/slide-over.tsx` (`SlideOverTitle`), `src/components/ui/confirm.tsx` (confirm title) — tighten title tracking to `-0.02em`.

**Interfaces:** none external — `StatusBadge` props unchanged.

- [ ] **Step 1: Resize the status badge**

In `src/components/ui/status-badge.tsx`, the `badgeVariants` base class (line 8) currently:

```tsx
  "inline-flex items-center gap-1 rounded-none px-2 py-1 font-mono text-mono-sm font-semibold uppercase tracking-[0.06em]",
```

The prototype badge is `--m-xs` (`11px`), padding `3px 7px`, with the `●` inline (no gap). Replace with:

```tsx
  "inline-flex items-center rounded-none px-[7px] py-[3px] font-mono text-mono-xs font-semibold uppercase tracking-[0.06em]",
```

(Removing `gap-1` collapses the dot against the label; the `dot` span renders `●` directly before the text. Padding `3px 7px` matches the prototype. `text-mono-xs` = `--m-xs`.)

- [ ] **Step 2: Resize the table header + cell**

In `src/components/ui/table.tsx`:

`TableHead` (line 52) currently:

```tsx
        "border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 font-mono text-mono-sm font-semibold tracking-[0.07em] text-[var(--ink2)] uppercase",
```

Change to `text-mono-xs` and padding `12px 16px`:

```tsx
        "border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 font-mono text-mono-xs font-semibold tracking-[0.07em] text-[var(--ink2)] uppercase",
```

(`px-4` = 16px horizontal ✓; `py-3` = 12px vertical ✓; `text-mono-xs` = `--m-xs` ≈ 11px ✓.)

`TableCell` (line 64) currently:

```tsx
      className={cn("px-4 py-3 align-middle text-small", className)}
```

The prototype row vertical padding is `16px`. Change `py-3` (12px) → `py-4` (16px):

```tsx
      className={cn("px-4 py-4 align-middle text-small", className)}
```

- [ ] **Step 3: Tighten card/dialog title tracking**

The prototype's auth card titles use `letter-spacing:-.02em` (XF-07). Audit note found the kit's `CardTitle`, `DialogTitle`, `SlideOverTitle`, and the confirm title all use `tracking-[-0.01em]`. Tighten each to `-0.02em` to match the prototype's display titles. In each of:

- `src/components/ui/card.tsx` (`CardTitle`)
- `src/components/ui/dialog.tsx` (`DialogTitle`)
- `src/components/ui/slide-over.tsx` (`SlideOverTitle`)
- `src/components/ui/confirm.tsx` (the confirm title element)

change `tracking-[-0.01em]` → `tracking-[-0.02em]`. (Use `grep -rn "tracking-\[-0.01em\]" src/components/ui` to find every occurrence; the four above are the known set.) Leave body and small text tracking unchanged.

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Visual check**

Run: `pnpm dev`, navigate to a screen with a `StatusBadge` and a table (e.g. `/admin/solutions`), and open a dialog/slide-over (e.g. `/admin/people` → edit).
`verdict goto http://localhost:3000/admin/solutions` then `verdict snapshot -i`.
Confirm: badges are visibly smaller (11px mono, tighter padding, `●` flush against the label); table headers are 11px mono; rows have more vertical breathing room (16px); card/dialog titles read slightly tighter (`-0.02em`).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/status-badge.tsx src/components/ui/table.tsx src/components/ui/card.tsx src/components/ui/dialog.tsx src/components/ui/slide-over.tsx src/components/ui/confirm.tsx
git commit -m "fix(ui): badge --m-xs/3-7px; table header --m-xs + 16px cell; card/dialog title tracking -0.02em"
```

---

## Task 8: New `Chip` primitive (mixed-case sans bordered chip)

**Resolves:** XF-02 — provides the primitive Wave C will use for AP-04 (groups chips), AG-06 (people-reached chips), AG-07 (by-solution type badge). Wave A creates + exports it; adoption is Wave C.

**Files:**
- Create: `src/components/ui/chip.tsx`.

**Interfaces:**
- Produces: `Chip` — `<Chip tone="neutral|brand" truncate?>{children}</Chip>`. Renders a mixed-case sans chip: `1px solid var(--line)`, `--surface` bg, `--ink` text, 2px radius, padding `2px 7px`, optional ellipsis via `truncate`.

- [ ] **Step 1: Create the `Chip` component**

Create `src/components/ui/chip.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Ledger chip — mixed-case SANS (not mono), 1px hairline border, 2px radius,
// surface fill. For tags like group names and people-reached counts. Distinct
// from StatusBadge (mono uppercase on a semantic tint) — do not swap them.
const chipVariants = cva(
  "inline-flex max-w-full items-center rounded-[2px] border border-[var(--line)] bg-[var(--surface)] px-[7px] py-[2px] font-sans text-mono-xs font-medium text-[var(--ink)]",
  {
    variants: {
      tone: {
        neutral: "border-[var(--line)] text-[var(--ink)]",
        brand: "border-[var(--brand)] bg-[var(--brandtint)] text-[var(--brandink)]",
      },
      truncate: {
        true: "overflow-hidden text-ellipsis whitespace-nowrap",
        false: "",
      },
    },
    defaultVariants: {
      tone: "neutral",
      truncate: false,
    },
  },
);

function Chip({
  className,
  tone,
  truncate,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return (
    <span data-slot="chip" className={cn(chipVariants({ tone, truncate }), className)} {...props}>
      {children}
    </span>
  );
}

export { Chip, chipVariants };
```

(Note: `text-mono-xs` is used for the *size* token only — `11px` — but `font-sans` keeps the family Hanken Grotesk, so the chip renders mixed-case sans at 11px, matching the prototype's `t-xs` sans chips. The class name `text-mono-xs` is misleading here; if a `text-xs` utility exists in `@theme inline` aliasing `--t-xs`, prefer that. Check `globals.css` `@theme inline` — if `--text-xs: var(--t-xs)` is defined, use `text-xs` instead of `text-mono-xs` for clarity. The size is identical either way.)

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/chip.tsx
git commit -m "feat(ui): add Chip primitive (mixed-case sans bordered chip)"
```

---

## Task 9: Per-solution accent colors on the hub mono tile + side-rail tile

**Resolves:** HB-03, HB-04.

**Files:**
- Modify: `src/features/solutions-hub/components/solution-row.tsx:46-58` (`MONO_TILE` style).
- Modify: `src/features/solutions-hub/components/solutions-hub.tsx:343-360` (`RecentRailRow` tile).

**Interfaces:**
- Consumes: `Solution.accentColor` / `Solution.accentColorInvert` from Task 4. Both nullable; `null` → neutral fallback.

- [ ] **Step 1: Accent the hub row mono tile**

In `src/features/solutions-hub/components/solution-row.tsx`, the `MONO_TILE` style object (around line 46) currently sets a flat neutral background. Change it to resolve per-solution colors with a fallback.

First confirm the component receives the `solution` (or the row data) in scope — check the props. Then replace the tile's inline style so that when `accentColor` is set it's used as the background and `accentColorInvert` as the text color, otherwise fall back to `--panel` / `--ink`. Concretely, where the tile style is defined:

```tsx
const tileStyle = {
  background: solution.accentColor ?? "var(--panel)",
  color: solution.accentColorInvert ?? "var(--ink)",
  // ...existing width/height/flex-shrink/font rules unchanged
};
```

Apply `tileStyle` to the tile `<div>`. Keep all other tile rules (30×30, no radius, `flex-shrink:0`, mono font, weight 800) exactly as-is.

- [ ] **Step 2: Accent the side-rail recent tile**

In `src/features/solutions-hub/components/solutions-hub.tsx`, the `RecentRailRow` tile (around line 343) currently uses `background:"var(--panel)";color:"var(--ink)"`. Apply the same fallback pattern using the row's `accentColor`/`accentColorInvert`:

```tsx
background: solution.accentColor ?? "var(--panel)",
color: solution.accentColorInvert ?? "var(--ink)",
```

Keep the 26px size, mono `monogram`, and 10px font-size unchanged.

- [ ] **Step 3: Seed accent colors on demo solutions (optional but recommended for visual proof)**

To see the effect, seed a couple of demo solutions with accent colors. Check `scripts/seed-demo-solutions.ts` — where it sets `monogram`, also set `accentColor` / `accentColorInvert` on 2–3 solutions (e.g. `{ accentColor: "#2360c4", accentColorInvert: "#ffffff" }`, `{ accentColor: "#1f9a5c", accentColorInvert: "#ffffff" }`). Re-run the seed against the dev DB if it has an idempotent upsert; otherwise update rows directly via `pnpm db:studio`.

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Visual check**

Run: `pnpm dev`, `verdict goto http://localhost:3000` then `verdict snapshot -i`.
Confirm: seeded solutions show their accent-colored mono tiles (both in the catalogue rows and the side-rail recent list); unseeded solutions stay neutral grey.

- [ ] **Step 6: Commit**

```bash
git add src/features/solutions-hub scripts/seed-demo-solutions.ts
git commit -m "feat(hub): per-solution accent colors on mono tile + side-rail tile"
```

---

## Task 10: Per-solution accent in the viewer chat surface

**Resolves:** VW-01 (header), and lays the accent-color groundwork for the avatar/user-bubble/send (full chat theming is polished in Wave B).

**Files:**
- Modify: `src/features/solution-viewer/components/chat-slot.tsx:58` (header background).
- Modify: `src/components/ai-elements/message.tsx` (user-bubble + avatar background) and `prompt-input.tsx` (send button) — apply accent with brand fallback.

**Interfaces:**
- Consumes: the resolved solution's `accentColor`/`accentColorInvert`, threaded from the viewer page into the chat surface. Confirm how `chat-slot.tsx` currently receives the solution (props) and thread `accentColor`/`accentColorInvert` through if not already present (Task 4 surfaced them on the row type; the viewer resolver in `src/features/solution-viewer/server/resolve.ts` should already return them — verify with `grep -n "accentColor" src/features/solution-viewer`).

- [ ] **Step 1: Accent the chat header background**

In `src/features/solution-viewer/components/chat-slot.tsx` line 58, the header currently:

```tsx
background:"var(--brand)"
```

Replace with the accent (fallback brand):

```tsx
background: solution.accentColor ?? "var(--brand)"
```

If `solution` isn't in scope in this component, thread `accentColor`/`accentColorInvert` down as props from the viewer page (add them to the component's props interface and pass from the page that renders `<ChatSlot>`). Keep header text color white unless `accentColorInvert` is set — in that case use it:

```tsx
color: solution.accentColorInvert ?? "#fff"
```

- [ ] **Step 2: Accent the user bubble + avatar (message.tsx)**

In `src/components/ai-elements/message.tsx`, the user-role bubble and avatar currently use `bg-primary` (brand). Thread the accent color in via the same props path and apply:

```tsx
// user bubble + avatar:
background: accentColor ?? "var(--brand)",
color: accentColorInvert ?? "var(--onbrand)",
```

Keep the bot bubble as `var(--panel)` (Wave A leaves the `--panel-chat` shade refinement to Wave B / VW-03 — do not change it here to avoid scope creep). Keep the 3px radius and 26px avatar unchanged.

Because `message.tsx` is a generic AI-element primitive, prefer passing `accentColor`/`accentColorInvert` as optional props from `chat-conversation.tsx` (which has the solution context) rather than importing solution types into the generic component. If threading is invasive, scope this step to **header only** (Step 1) and defer bubble/avatar/send to Wave B — note that decision in the commit message.

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Visual check**

Run: `pnpm dev`, open a seeded chat solution (`/s/<slug>`).
`verdict goto http://localhost:3000/s/<seeded-slug>` then `verdict snapshot -i`.
Confirm: the chat header (and bubble/avatar/send if Step 2 was done) uses the solution's accent color; an unseeded solution falls back to brand blue.

- [ ] **Step 5: Commit**

```bash
git add src/features/solution-viewer src/components/ai-elements src/features/chat
git commit -m "feat(viewer): per-solution accent color on chat header (+ bubble/avatar/send)"
```

---

## Task 11: Button hover fix + `size: "auth"` + `Input` `inputSize: "auth"`

**Resolves:** XF-09, AU-01, AU-02 (the primitives; auth-screen *consumption* is Wave B, but the sizes must exist first).

**Files:**
- Modify: `src/components/ui/button.tsx:14-15,23` (hover + new size).
- Modify: `src/components/ui/input.tsx` (new `inputSize` prop).

**Interfaces:**
- Produces: `<Button size="auth">` (44px, `--t-title`) and `<Input inputSize="auth">` (42px, `--t-title`). Wave B's auth forms consume these.

- [ ] **Step 1: Fix button hover (brightness, not opacity)**

In `src/components/ui/button.tsx`, the `primary` and `dark` variants (lines 14-15) currently:

```tsx
        primary: "bg-primary font-bold text-primary-foreground hover:opacity-90",
        dark: "bg-[var(--ink)] font-bold text-[var(--on-ink)] hover:opacity-90",
```

Tailwind has no built-in `hover:brightness-` utility at the exact `.94`, so use an arbitrary value:

```tsx
        primary: "bg-primary font-bold text-primary-foreground hover:brightness-94",
        dark: "bg-[var(--ink)] font-bold text-[var(--on-ink)] hover:brightness-94",
```

If `hover:brightness-94` is not recognized (Tailwind v4 arbitrary opacity filters need the `[...]` syntax), use:

```tsx
        primary: "bg-primary font-bold text-primary-foreground hover:brightness-[0.94]",
        dark: "bg-[var(--ink)] font-bold text-[var(--on-ink)] hover:brightness-[0.94]",
```

(`brightness` darkens the fill uniformly without letting the page background bleed through, matching the prototype's `filter:brightness(.94)`.)

- [ ] **Step 2: Add `size: "auth"` to the button variants**

In `src/components/ui/button.tsx`, the `size` map (line 23) currently:

```tsx
      size: {
        default: "h-10 px-[18px]",
        sm: "h-8 px-3",
        icon: "size-10",
      },
```

Add the `auth` size (44px height, `--t-title` font-size):

```tsx
      size: {
        default: "h-10 px-[18px]",
        sm: "h-8 px-3",
        auth: "h-11 px-[18px] text-title",
        icon: "size-10",
      },
```

(`h-11` = 44px ✓; `text-title` = `--t-title` ✓, matching the prototype auth CTA. Confirm `text-title` is a valid utility — `globals.css` `@theme inline` defines `--text-title`, so `text-title` works. If not, use `text-[var(--t-title)]`.)

- [ ] **Step 3: Add `inputSize: "auth"` to `Input`**

In `src/components/ui/input.tsx`, the component currently has no size prop. Add an optional `inputSize` and use it to override height + font-size. Replace the whole function:

```tsx
import { cn } from "@/lib/utils";

// Ledger input: 40px default, hairline border, square, 12px padding, body type.
// `inputSize="auth"` → 42px / --t-title for the auth surface (prototype AU-01).
// Focus ring is the shared form-control rule in globals.css.
type InputSize = "default" | "auth";

function Input({
  className,
  inputSize = "default",
  ...props
}: React.ComponentProps<"input"> & { inputSize?: InputSize }) {
  return (
    <input
      data-slot="input"
      className={cn(
        "w-full rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 font-sans text-foreground placeholder:text-[var(--ink3)] disabled:cursor-not-allowed disabled:opacity-50",
        inputSize === "auth"
          ? "h-[42px] text-title"
          : "h-10 text-body",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx
git commit -m "feat(ui): button hover brightness + size 'auth' (44px); Input inputSize 'auth' (42px)"
```

---

## Task 12: Wave A verification + docs touch-up

**Resolves:** cross-wave continuity.

**Files:**
- Modify: `docs/execution-log` (append a Wave A entry if that's the project's convention — check `ls docs/execution-log`).

- [ ] **Step 1: Full typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS, clean.

- [ ] **Step 2: Full visual sweep against the prototype**

Run: `pnpm dev`. Walk every Wave A-affected surface and compare to the prototype:
- Fonts (all screens) — Archivo/Hanken/Plex.
- Hub (`/`) — breakpoint at 920px, padding ladder at 1180/1440, accent tiles.
- Viewer (`/s/<slug>`) — accent header.
- Any table/badge screen — smaller badges, 11px headers, 16px row padding.
- Slide-over (open any record editor, e.g. `/admin/people` → edit) — darker scrim.
- A loading skeleton (trigger a suspending list) — faster 1.1s shimmer.

Use `verdict` per surface. Note any remaining drift for Wave B/C — do **not** fix out-of-scope items here.

- [ ] **Step 3: Commit any docs/log update**

```bash
git add docs/
git commit -m "docs(log): Wave A foundations complete — fonts, hub CSS, theming, kit sizes"
```

- [ ] **Step 4: Report**

Summarize Wave A completion: which findings (XF-01/03/04/05/06/08/09/10, HB-01/02/03/04, VW-01) are resolved, which are deferred to Wave B/C, and the visual-diff highlights. Hand off to Wave B planning.

---

## Out of scope for Wave A (explicitly deferred)

All auth-surface consumption (AU-01…AU-08 actual form changes), hub rail `· updated` (HB-05) + Fullscreen tip card (HB-06), viewer status-page link (VW-02) + bot-bubble shade (VW-03), account trusted-devices card (AC-01…), and the **entire admin console** (all AP-/AG-/ASol-/AT- findings including the four P0s). These are Wave B and Wave C respectively.
