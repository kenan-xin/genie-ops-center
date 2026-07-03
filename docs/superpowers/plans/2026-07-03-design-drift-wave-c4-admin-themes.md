# Design Drift — Wave C4 (Admin → Themes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin Theme Builder into prototype conformance — resolving AT-00…AT-08 (the final wave of the design-drift spec).

**Architecture:** All changes are contained to the themes feature: curated data (`theme.ts`), the builder screen (`theme-builder.tsx`), and the live preview (`theme-preview.tsx`). No kit primitives are edited — the `Tabs` kit is restyled via `className`. The Custom-CSS editor stays a **functional** textarea (real `config.customCss`) but is dark-styled to match the prototype's editor aesthetic (the prototype's is a non-functional mock; we do not regress a working feature).

**Tech Stack:** Next.js 16 · React 19 · Tailwind v4 + shadcn-on-Base-UI · react-hook-form + zod.

## Global Constraints

_Every task's requirements implicitly include this section._

- **Prototype is ground truth:** `docs/design-package/Genie Control Station.dc.html` (theme-builder block, lines ~893–976; JS style builders ~1773–1783, 1925–1928). Refs in tasks point here.
- **NEVER a fixed-px font utility.** `text-xs` = Tailwind's fixed 0.75rem = a violation. Use token utilities: `text-body`, `text-small` (=`--t-sm`; note `--t-xs`===`--t-sm`===`text-small`, so the prototype's `--t-xs` IS `text-small`), `text-title`, mono `text-mono-xs`=`--m-xs`, `text-mono-sm`=`--m-sm`, `text-mono-md`=`--m-md`. Explicit arbitrary hex colors for the CSS-editor mock (`#0f1319`, `#cdd6e3`, `#4a5568`) are correct — they match the prototype's literal editor colors and have no design token.
- **Fonts:** `font-sans`=Hanken Grotesk, `font-heading`=Archivo, `font-mono`=IBM Plex Mono. `text-mono-*` sets size only.
- **Color tokens (use CSS vars):** `--ink` #14161b, `--ink2`, `--ink3`, `--line`, `--line2`, `--panel`, `--surface`, `--brand`/`--brandink` #2360c4, `--brandtint` #eef4fc, `--on-ink`.
- **Verification cycle (no unit-test runner):** `pnpm typecheck` + `pnpm lint` both clean; the pre-commit hook does NOT run tsc, so run `pnpm typecheck` explicitly as the final gate. Visual via `verdict` where reachable (login restored: `admin@example.com` / `Sup3rSecret!pw`).
- **Implementer/reviewer model:** `sonnet`; final whole-branch review on `opus`.

## Adopted decisions (defaults; documented)

- **DEC-C4-A — AT-00 CSS editor: dark-STYLE the functional textarea, don't regress it to a mock.** The prototype's CSS tab is an explicitly presentational stack of `<div>`s ("Editor is presentational in this prototype.", static caret, fake syntax highlighting). The app's Custom CSS is a **real** editor (`register("config.customCss")`, applied to the scoped preview). Conformance = give the real `<textarea>` the prototype's dark aesthetic (`#0f1319` bg, `#cdd6e3` mono text, `1.7` line-height). We do NOT add the "presentational" note (false — ours works), a fake caret, or a syntax-highlighter dependency. This is the AC-01 / ASol-07 honest-hybrid ethos.
- **DEC-C4-B — AT-01 theme switching = documented non-defect.** The app switches themes via `router.push('/admin/themes/[id]')`, which in the Next app router is a **soft** client navigation (no full page reload); `ThemeBuilderEditor key={selected.id}` remounts the editor against the new theme — functionally the prototype's in-place swap. The spec's "full reload" characterization is stale. No code change; documented like AS-02.
- **AT-05 font values kept stable (no migration).** Existing themes store `font` values `"system"/"serif"/"mono"/"rounded"` (a zod enum). The labels + font stacks are re-pointed to the app's real fonts and the options reordered to match the prototype, but the enum **values** stay stable so existing themes keep parsing. Caveat: the preview iframe (`sandbox=""`, `srcDoc`) can't load the app's `next/font` faces, so "Hanken"/"Archivo" render as a system fallback **in the admin preview only** — the real chat surface (which loads the fonts) renders them correctly.

---

## File Structure

- `src/features/themes/schemas/theme.ts` — **modify:** `RADIUS_PRESETS` values (AT-04); `FONT_OPTIONS` labels/stacks/order (AT-05).
- `src/features/themes/components/theme-builder.tsx` — **modify:** selected-pill styling (AT-02); color-swatch ring/size (AT-03); Custom-CSS dark editor (AT-00); tab padding/equal-width (AT-07); preset-cards flex-wrap (AT-08).
- `src/features/themes/components/theme-preview.tsx` — **modify:** header avatar + "Sample Assistant"/"Preview · {name}" labels, 82% bubbles, device widths; add optional `name` prop (AT-06).
- `src/features/solutions/components/edit-solution-slide-over.tsx` — **touch:** the one other `<ThemePreview>` consumer (Configure) — confirm it still compiles with the new optional prop (no change needed since `name` is optional).
- `docs/execution-log/index.md` — **append** the Wave C4 entry (final task).

---

## Task 1: Theme data — radius + font presets (AT-04, AT-05)

**Files:** Modify `src/features/themes/schemas/theme.ts`.

**Prototype refs:** radius `.dc.html:1781` (`Sharp=4/Soft=12/Round=20`); fonts `:1782` (`Hanken/'Hanken Grotesk'`, `Archivo/'Archivo'`, `Mono/'IBM Plex Mono'`, `Serif/Georgia, serif`).

- [ ] **Step 1: AT-04 — radius preset values.** Change `RADIUS_PRESETS` to the prototype values:

```ts
export const RADIUS_PRESETS = [
  { value: 4, label: "Sharp" },
  { value: 12, label: "Soft" },
  { value: 20, label: "Round" },
] as const;
```

(Leave `THEME_PRESETS[*].config.radius` as-is — those are per-preset seed values, a separate concern from the pickable radius options.)

- [ ] **Step 2: AT-05 — font options relabel/repoint/reorder, values STABLE.** Replace `FONT_OPTIONS` so labels + stacks match the prototype and the order is Hanken/Archivo/Mono/Serif, but keep the existing `value` strings (so stored themes still parse — do NOT rename the values):

```ts
export const FONT_OPTIONS = [
  // value ids are kept stable for back-compat with stored themes; labels + stacks
  // now reflect the app's real fonts (prototype .dc.html:1782). The admin preview
  // iframe (sandbox="", no next/font) falls back to system for Hanken/Archivo;
  // the real chat surface renders them.
  { value: "system", label: "Hanken", stack: "'Hanken Grotesk', system-ui, sans-serif" },
  { value: "rounded", label: "Archivo", stack: "'Archivo', system-ui, sans-serif" },
  { value: "mono", label: "Mono", stack: "'IBM Plex Mono', ui-monospace, monospace" },
  { value: "serif", label: "Serif", stack: "Georgia, serif" },
] as const;
```

(`FONT_VALUES`/`fontStack`/`themeConfigSchema` derive from this array and need no other change; the enum membership `{system,rounded,mono,serif}` is unchanged.)

- [ ] **Step 3: Verify + commit.**
```bash
pnpm typecheck && pnpm lint      # both clean
git add src/features/themes/schemas/theme.ts
git commit -m "fix(admin-themes): radius presets 4/12/20 + font options Hanken/Archivo/Mono/Serif (AT-04/05)

Font enum values kept stable (no migration); labels/stacks repointed to real fonts."
```

---

## Task 2: Theme builder — pill, swatches, dark CSS editor, tabs, preset layout (AT-02, AT-03, AT-00 P0, AT-07, AT-08)

**Files:** Modify `src/features/themes/components/theme-builder.tsx`.

**Prototype refs:** pill `.dc.html:898,1773`; swatches `:1777`; tabs `:904,1783`; CSS mock `:933–944`; preset cards `:908,1775,910–912`.

- [ ] **Step 1: AT-02 — selected pill styling.** In `ThemeChip`, change the active branch from inverted-ink to brand-tinted, and enlarge the swatch to 12px:

```tsx
className={cn(
  "flex items-center gap-[7px] border px-[11px] py-1.5 font-sans text-small font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
  active
    ? "border-[var(--brand)] bg-[var(--brandtint)] text-[var(--ink)]"
    : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--panel)]",
)}
```

And the swatch span: `size-3` (12px) instead of `size-2.5`:
```tsx
<span aria-hidden className="size-3 shrink-0 rounded-full border border-[rgba(0,0,0,0.15)]" style={{ background: theme.config.headerColor }} />
```

- [ ] **Step 2: AT-03 — color swatch ring + size.** In `SwatchField`, make swatches 26px with the prototype's double-ring (white gap + tone ring) via inline `boxShadow`, dropping the `border-2`/`scale` treatment:

```tsx
<button
  key={hex}
  type="button"
  aria-label={hex}
  aria-pressed={value === hex}
  onClick={() => onChange(hex)}
  className="size-[26px] shrink-0 rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
  style={{
    background: hex,
    boxShadow:
      value === hex
        ? "0 0 0 2px var(--surface), 0 0 0 4px var(--ink)"
        : "0 0 0 2px var(--surface), 0 0 0 3px var(--line)",
  }}
/>
```

Change the swatch row gap to 12px: the wrapping `div` → `className="flex flex-wrap items-center gap-3"`.

- [ ] **Step 3: AT-00 (P0) — dark-style the Custom CSS editor.** In the `css` `TabsPanel`, dark-theme the existing functional `<Textarea>` to match the prototype editor (`#0f1319` bg, `#cdd6e3` mono text, `1.7` line-height). KEEP it functional (`register("config.customCss")`); do NOT add a "presentational" note or a fake caret. Replace the Textarea's className:

```tsx
<Textarea
  id="customCss"
  rows={12}
  spellCheck={false}
  placeholder=".bubble.user { ... }"
  className="border-[var(--line)] bg-[#0f1319] font-mono text-mono-sm leading-[1.7] text-[#cdd6e3] placeholder:text-[#4a5568]"
  {...register("config.customCss")}
/>
```

Keep the existing scoping note `<p>` below it (it's accurate). (If the kit `Textarea`'s default focus/border styles fight the dark bg, add `focus-visible:border-[var(--brand)]` — but do not lighten the background.)

- [ ] **Step 4: AT-07 — tab padding + equal-width.** The kit `TabsTab` font is already `text-small` (= the prototype's `--t-xs`). Make the strip full-width with equal tabs and tighten the horizontal padding to 10px. On the theme-builder's `Tabs`:

```tsx
<TabsList className="flex w-full">
  <TabsTab value="presets" className="flex-1 px-2.5 text-center">Presets</TabsTab>
  <TabsTab value="elements" className="flex-1 px-2.5 text-center">Elements</TabsTab>
  <TabsTab value="css" className="flex-1 px-2.5 text-center">Custom CSS</TabsTab>
</TabsList>
```

(`flex w-full` overrides the kit's `inline-flex`; `flex-1` makes tabs equal-width; `px-2.5`=10px overrides the kit's `px-4`; `py-2`=8px stays. Tab copy stays Presets/Elements/Custom CSS.)

- [ ] **Step 5: AT-08 — preset cards flex-wrap.** Change the presets container from a fixed 2-col grid to flex-wrap with min-118px cards, and bump the label weight to 700:
  - Container: `<div className="grid grid-cols-2 gap-3">` → `<div className="flex flex-wrap gap-3">`.
  - Each preset `<button>`: add `flex-1 min-w-[118px]` to its className (keep the existing border/hover/`data-[active]` styles + the `h-[30px]` color bar).
  - The preset label span: `text-small font-semibold` → `text-small font-bold`. (Keep the `preset.description` line.)

- [ ] **Step 6: Verify.** `pnpm typecheck && pnpm lint` → both clean.

- [ ] **Step 7: Visual + commit.** `verdict` `/admin/themes` if reachable: brand-tinted selected pill w/ 12px swatch, 26px ring swatches, dark CSS editor (still typable), equal-width tabs, flex-wrap preset cards. Then:
```bash
git add src/features/themes/components/theme-builder.tsx
git commit -m "fix(admin-themes): pill/swatch/tabs/preset-card styling + dark CSS editor (AT-02/03/07/08 + AT-00)

AT-00: dark-styled the FUNCTIONAL Custom-CSS textarea (not a presentational mock) per DEC-C4-A."
```

---

## Task 3: Theme preview chrome — avatar + labels + 82% bubbles (AT-06)

**Files:** Modify `src/features/themes/components/theme-preview.tsx`. (The other `<ThemePreview>` consumer — `edit-solution-slide-over.tsx` — needs no change since the new prop is optional; confirm it still typechecks.)

**Prototype refs:** preview chrome `.dc.html:958–970`; avatar `:960`; labels `:961`; bubbles `:964–966` (82%); device widths `:1925` (`320`/`470`).

- [ ] **Step 1: Add an optional `name` prop.** Change the signature to `export function ThemePreview({ config, name }: { config: ThemeConfig; name?: string })` and pass it into the HTML builder: `buildPreviewHtml(config, name)`. Update `buildPreviewHtml(config: ThemeConfig, name?: string)`.

- [ ] **Step 2: Device widths (AT-06).** Update `DEVICE_WIDTH` to the prototype's per-device caps: `{ desktop: 470, mobile: 320 }`. (Keep `PREVIEW_HEIGHT = 560` — the sandboxed iframe needs an explicit height; auto-sizing would require a script, which `sandbox=""` blocks. This is the app's deliberate CSS-scoping approach; note it.)

- [ ] **Step 3: Header avatar + labels (AT-06).** In `buildPreviewHtml`, replace the plain `.header` (currently `<div class="header">Assistant</div>`) with an avatar + two-line label block. Add to the `<style>`:

```css
.header { background: ${config.headerColor}; color: #fff; padding: 13px 15px; display: flex; align-items: center; gap: 10px; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
.hmeta { min-width: 0; }
.hname { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hsub { font-size: 12px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

and the markup:
```html
<div class="header">
  <div class="avatar">A</div>
  <div class="hmeta">
    <div class="hname">Sample Assistant</div>
    <div class="hsub">${escapeHtml(name ? `Preview · ${name}` : "Preview")}</div>
  </div>
</div>
```

- [ ] **Step 4: Bubbles 82% (AT-06).** In the `.bubble` rule, change `max-width: 78%` → `max-width: 82%`.

- [ ] **Step 5: Pass the theme name from the builder.** In `theme-builder.tsx` `ThemeBuilderEditor`, watch the name and pass it: add `const name = useWatch({ control, name: "name" });` and render `<ThemePreview config={config} name={name} />`. (Leave the Configure consumer in `edit-solution-slide-over.tsx` as `<ThemePreview config={selectedThemeConfig} />` — no name → the preview shows "Preview" without a theme name.)

- [ ] **Step 6: Verify.** `pnpm typecheck && pnpm lint` → both clean.

- [ ] **Step 7: Visual + commit.** `verdict` `/admin/themes` → preview header shows a 32px "A" avatar + "Sample Assistant" + "Preview · {theme name}", bubbles at 82%; and open a chat solution's Configure → its `ThemePreview` still renders (header "Sample Assistant" + "Preview"). Then:
```bash
git add src/features/themes/components/theme-preview.tsx src/features/themes/components/theme-builder.tsx
git commit -m "fix(admin-themes): preview chrome — 32px avatar, Sample Assistant/Preview labels, 82% bubbles (AT-06)"
```

(Note: Task 2 already committed `theme-builder.tsx`; Step 5's small addition here is a second commit to that file — fine.)

---

## Task 4: Verify branch + execution log

**Files:** Modify `docs/execution-log/index.md`.

- [ ] **Step 1: Full-branch verify.** `pnpm typecheck && pnpm lint` → both clean (only pre-existing `scripts/` warnings).
- [ ] **Step 2: Visual QA sweep.** `verdict` `/admin/themes` at 920/1180/1440 (pills, swatches, tabs, dark CSS editor, preset cards, preview chrome); note residual drift.
- [ ] **Step 3: Append the Wave C4 execution-log entry** — findings AT-00/02/03/04/05/06/07/08 resolved; decisions DEC-C4-A (dark-styled functional CSS editor, not a mock), DEC-C4-B (AT-01 route-based soft-nav = non-defect), AT-05 font enum-values-stable + preview-iframe font caveat; note that this **completes the entire 3-wave design-drift spec** (Waves A, B, C1–C4).
- [ ] **Step 4: Commit.**
```bash
git add docs/execution-log/index.md
git commit -m "docs(log): Wave C4 admin Themes complete — pill/swatch/tabs/dark-CSS/preview; design-drift spec DONE"
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** AT-00 (T2 dark CSS), AT-01 (T4 non-defect doc), AT-02 (T2 pill), AT-03 (T2 swatch), AT-04 (T1 radius), AT-05 (T1 fonts), AT-06 (T3 preview), AT-07 (T2 tabs), AT-08 (T2 presets). All nine mapped.
- **Placeholder scan:** none — exact hex, tokens, box-shadow strings, copy, and widths given.
- **Type consistency:** `ThemeConfig`, `FONT_OPTIONS`/`FONT_VALUES`, `RADIUS_PRESETS`, `ThemePreview` prop names match definitions; the new `name` prop is optional so the Configure consumer is unaffected.
- **No kit edits / no regressions:** `Tabs` restyled via `className` only; `Textarea` dark-styled via `className` only (stays functional); `ThemePreview`'s new prop is optional. Font enum values kept stable (no data migration).
