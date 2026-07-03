# Design Drift — Wave C3 (Admin → Solutions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin Solutions directory, the Register dialog, and the Configure surface into prototype conformance — resolving ASol-00…ASol-10.

**Architecture:** The Solutions directory keeps its per-row-mutation component structure and gets prototype column proportions via a `<colgroup>` (DEC-C3-C). The Configure surface converts from a right-edge slide-over to the existing centered `Dialog` primitive (already 460px). The Register dialog and Configure modal reuse the kit `DialogClose` for their `✕`. `StatusBadge`+`Select` in the status cell collapse into a single tone-styled badge-select.

**Tech Stack:** Next.js 16 · React 19 · Tailwind v4 + shadcn-on-Base-UI · tRPC + zod · Drizzle ORM.

## Global Constraints

_Every task's requirements implicitly include this section._

- **Prototype is ground truth:** `docs/design-package/Genie Control Station.dc.html` (the `adDemos` block, lines 680–719; register 981–995; configure 997–1035). Refs in tasks point here.
- **NEVER a fixed-px font utility.** `text-xs` = Tailwind's fixed 0.75rem = a violation. Use token utilities: `text-body`, `text-small` (=`--t-sm`; `--t-xs`===`--t-sm`===`text-small`), `text-title` (=`--t-h3`), `text-cardhead`, mono `text-mono-xs`=`--m-xs`, `text-mono-sm`=`--m-sm`, `text-mono-md`=`--m-md`. **Exception:** a monogram glyph may use `text-[10px]` to match the prototype's literal 10px (as the People/Groups avatars already do) — that is an explicit arbitrary value matching the prototype, not the fixed-token trap.
- **Fonts:** `font-sans`=Hanken Grotesk, `font-heading`=Archivo, `font-mono`=IBM Plex Mono. `text-mono-*` sets size only; mono family needs `font-mono`; Archivo needs `font-heading`.
- **Color tokens (use CSS vars):** `--ink` #14161b, `--ink2` #4a515c, `--ink3` #8b929c, `--line` #c8cdd5, `--line2` #e2e5ea, `--panel` #f6f7f9, `--surface` #fff, `--brand`/`--brandink` #2360c4, `--brandtint` #eef4fc, `--on-ink`, `--error`/`--errortint`, `--success`/`--successtint`, `--warn`/`--warntint`. Reuse the tint tokens `StatusBadge` already uses.
- **Verification cycle (no unit-test runner):** `pnpm typecheck` + `pnpm lint` both clean; the pre-commit hook does NOT run tsc, so run `pnpm typecheck` explicitly as the final gate. Visual via `verdict` where reachable (login restored: `admin@example.com` / `Sup3rSecret!pw`; `pnpm reset-admin` to restore).
- **Implementer/reviewer model:** `sonnet`; final whole-branch review on `opus`.

## Adopted decisions (defaults; **flagged for the pre-execution checkpoint**)

- **DEC-C3-A — Native stays hidden (ASol-02/03 = documented non-defects).** The app deliberately makes `native` an enum-only, unregisterable, catalogue-hidden type (`solutionTypeSchema = z.enum(["chat","embedded"])`; `Solution.type` excludes native; `solutions.list` never returns native rows). The prototype's admin table lists native rows (label `NATIVE`, no Configure gear) and offers Native in the filter + register. Matching it would require widening `Solution.type` + making `solutions.list` return native rows + adding a register path for a type the tech-plan says is never granted/openable. **Default:** do NOT add Native to the filter or register; document ASol-02 + ASol-03 as accepted non-defects (like AS-02). No code.
- **DEC-C3-B — Embedded config = honest-hybrid (ASol-07).** The prototype's embedded fields (App URL / Frame Height / Allow fullscreen / Open in a new tab) are **static mockups** (no handlers, `defaultValue` only), and the app's embedded viewer is a deliberately security-hardened, **full-page** sandbox (`sandbox="allow-scripts allow-forms"`, no fullscreen, no popups) that already exposes an "open in new tab ↗" control. **Default (no fake controls, per the AC-01 ethos):** rename the "iframe URL" field label → **"App URL"**; ADD a real **"Allow fullscreen"** toggle wired to a new `config.allowFullscreen` that conditionally sets the iframe `allow="fullscreen"`; **OMIT** "Frame Height" (a fixed height fights the full-page viewer) and a separate "Open in a new tab" toggle (the viewer already always offers it — a toggle to hide it would be a regression). Document the two omissions.
- **DEC-C3-C — Solutions directory uses a `<colgroup>`, not a TanStack rewrite (ASol-01).** Unlike People (C1) / Groups (C2), the Solutions table has per-row mutations (status/duplicate/archive/delete) with per-row `busy` state, and its search + sort are already server-side — so TanStack would add no functional benefit and would force lifting all row actions to table level (per-row busy via a `busyId`, `meta` threading). ASol-01's finding is column proportions only. **Default:** add a `<colgroup>` (`fr`→%) + `table-fixed` + `min-w-[880px]` to the existing `Table`/`SolutionRow` structure. (D1's TanStack pattern remains the choice for the filter-driven People/Groups directories.)

---

## File Structure

- `src/features/solutions/components/solutions-directory.tsx` — **modify:** colgroup + `table-fixed`/`min-w-[880px]` (ASol-01); avatar 30px/no-border/Archivo (ASol-05); status badge-select (ASol-06); type font (ASol-09); remove subtitle (ASol-10).
- `src/features/solutions/components/register-solution-dialog.tsx` — **modify:** description Textarea → single-line Input (ASol-04); add header `✕` (ASol-08).
- `src/features/solutions/components/edit-solution-slide-over.tsx` — **rebuild:** SlideOver → centered `Dialog` (ASol-00), `CONFIGURE · {type}` eyebrow + `✕`, scrollable body, footer Cancel/Save. (Filename kept; it is the Configure surface.)
- `src/features/solutions/schemas/solution.ts` — **modify:** `embeddedConfigSchema` += `allowFullscreen` (ASol-07).
- `src/features/solution-viewer/components/embedded-view.tsx` — **modify:** accept + apply `allowFullscreen` (ASol-07 real wiring).
- The component that renders `<EmbeddedView>` — **modify:** thread `allowFullscreen` from the solution's embedded config (grep for `<EmbeddedView`).
- `docs/execution-log/index.md` — **append** the Wave C3 entry (final task).

---

## Task 1: Solutions directory — colgroup + avatar + status badge-select + type font + subtitle (ASol-01 P0, ASol-05, ASol-06, ASol-09, ASol-10)

**Files:** Modify `src/features/solutions/components/solutions-directory.tsx`.

**Prototype refs:** header/rows `.dc.html:693–700`; avatar `:697`; type `:698`; status badge-select `:700` + `statusSelStyle`/`statusMeta` `:1679,1450`; heading (no subtitle) `:683–686`.

- [ ] **Step 1: Remove the subtitle (ASol-10).** In the `<header>`, delete the `<p className="text-small text-[var(--ink2)]">Register and configure the chat and embedded solutions available to your groups.</p>`. Keep the `<h1>Solutions</h1>` and the `+ Add` button. (The `+ Add` button copy/style is not a listed finding — leave it.)

- [ ] **Step 2: Add the colgroup + widths (ASol-01).** In `SolutionsTable`, give the table `className="min-w-[880px] table-fixed"` and add a `<colgroup>` reproducing `1.5fr .5fr .9fr 1.6fr` (sum 4.5fr → %):

```tsx
<Table className="min-w-[880px] table-fixed">
  <colgroup>
    <col style={{ width: "33.333%" }} />
    <col style={{ width: "11.111%" }} />
    <col style={{ width: "20%" }} />
    <col style={{ width: "35.556%" }} />
  </colgroup>
  <TableHeader>
    <TableRow>
      <TableHead>Solution</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  ...
```

(Drop the per-`TableHead` `w-[40%]`/`w-[15%]`/… — the colgroup owns widths now. The kit `TableHead` already renders the prototype's mono-uppercase `--m-xs` header on `--panel`.)

- [ ] **Step 3: Avatar 30px, no border, Archivo 800 (ASol-05).** In `SolutionRow`, change the monogram span from `size-8 ... border border-[var(--line)] font-mono text-mono-sm font-bold text-[var(--ink2)]` to match the prototype (`30×30`, no border, `--panel` bg, Archivo 800, 10px, `--ink`) — mirroring the People/Groups avatar:

```tsx
<span
  aria-hidden
  className="flex size-[30px] shrink-0 items-center justify-center bg-[var(--panel)] text-[10px] font-heading font-extrabold text-[var(--ink)]"
>
  {solution.monogram ?? "·"}
</span>
```

(Adjust the row's avatar↔text `gap-3` to `gap-[11px]` per the prototype if trivial; otherwise `gap-3` is acceptable.)

- [ ] **Step 4: TYPE cell font (ASol-09).** Change the type cell from `font-mono text-mono-sm text-[var(--ink2)]` to `--m-md` weight 600 UPPERCASE. The prototype shows `CHAT`/`EMBED` (embedded→`EMBED`), so use an uppercase label map (same shape as C2's), not the mixed-case `TYPE_LABEL`:

```tsx
// module scope
const TYPE_LABEL_UPPER: Record<SolutionType, string> = { chat: "CHAT", embedded: "EMBED" };
// cell
<span className="font-mono text-mono-md font-semibold uppercase text-[var(--ink2)]">
  {TYPE_LABEL_UPPER[solution.type]}
</span>
```

- [ ] **Step 5: Status badge-select (ASol-06).** Replace the `<div className="flex items-center gap-2"><StatusBadge …/><Select …/></div>` (the non-archived branch) with a SINGLE tone-styled `Select` (drop the separate `StatusBadge`). Add a tone→class map and pass it as the Select `className` (the kit `Select`'s `className` styles the trigger):

```tsx
// module scope
const STATUS_SELECT_CLASS: Record<SolutionStatus, string> = {
  ready: "border-[var(--success)] bg-[var(--successtint)] text-[var(--success)]",
  draft: "border-[var(--ink3)] bg-[var(--panel)] text-[var(--ink3)]",
  maintenance: "border-[var(--warn)] bg-[var(--warntint)] text-[var(--warn)]",
  down: "border-[var(--error)] bg-[var(--errortint)] text-[var(--error)]",
};
// non-archived status cell
<Select
  items={STATUS_ITEMS}
  value={solution.status}
  onValueChange={(v) => void handleStatusChange(v as SolutionStatus)}
  disabled={busy}
  aria-label={`Status for ${solution.name}`}
  className={cn(
    "h-auto w-auto gap-1.5 border px-2 py-1 font-mono text-mono-sm font-semibold tracking-[0.06em] uppercase",
    STATUS_SELECT_CLASS[solution.status],
  )}
/>
```

(`cn` is already imported. twMerge lets these override the trigger defaults: `h-10`→`h-auto`, `w-full`→`w-auto`, `px-3`→`px-2`, `border-[var(--line)]`→tone border, `text-body`/`font-sans`→`text-mono-sm`/`font-mono`. If a `--successtint`/`--warntint` token turns out not to exist, use the exact tint token `StatusBadge` uses for that tone.) Keep the archived branch but change it to the prototype's `--m-md` weight 500: `<span className="font-mono text-mono-md font-medium text-[var(--ink3)]">Hidden from hub</span>`.

- [ ] **Step 6: Verify.** `pnpm typecheck && pnpm lint` → both clean. If `StatusBadge` is now unused in this file (it is still used for the "Archived" chip beside the name — keep the import), confirm no unused-import lint error.

- [ ] **Step 7: Visual + commit.** `verdict` `/admin/solutions` if reachable (4-col proportions, 30px borderless Archivo avatar, single colored status-select, uppercase mono type, no subtitle). Then:
```bash
git add src/features/solutions/components/solutions-directory.tsx
git commit -m "fix(admin-solutions): directory colgroup proportions + avatar/status-select/type/subtitle (ASol-01/05/06/09/10)"
```

---

## Task 2: Register dialog — single-line description + `✕` close (ASol-04, ASol-08)

**Files:** Modify `src/features/solutions/components/register-solution-dialog.tsx`.

**Prototype refs:** register dialog `.dc.html:985` (`✕`), `:989` (single-line description input).

- [ ] **Step 1: Description Textarea → single-line Input (ASol-04).** Replace the `<Textarea id="reg-desc" rows={2} .../>` with `<Input id="reg-desc" placeholder="One-line summary shown on the card" {...register("description")} />`. Remove the now-unused `Textarea` import.

- [ ] **Step 2: Add the header `✕` (ASol-08).** Import `DialogClose` from `@/components/ui/dialog`. Add a close button in the `DialogContent` (top-right), matching the prototype (`--ink3`, `--t-h3`):

```tsx
<DialogClose
  aria-label="Close"
  className="absolute right-4 top-4 text-title text-[var(--ink3)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-ring"
>
  ✕
</DialogClose>
```

(`DialogContent` is `relative`, so `absolute` positions correctly. `DialogClose` closes the dialog via Base UI; the existing `onOpenChange`→`handleClose` still runs `reset()`.)

- [ ] **Step 3: Verify + commit.** `pnpm typecheck && pnpm lint` clean; `verdict` if reachable. Then:
```bash
git add src/features/solutions/components/register-solution-dialog.tsx
git commit -m "fix(admin-solutions): register dialog single-line description + close X (ASol-04/08)"
```

(ASol-03 "Native in register" is a documented non-defect per DEC-C3-A — no change.)

---

## Task 3: Configure surface — slide-over → centered modal (ASol-00 P0)

**Files:** Modify `src/features/solutions/components/edit-solution-slide-over.tsx`.

**Prototype refs:** configure modal `.dc.html:999–1035`; card `max-width:460px;max-height:88vh;overflow:auto` `:1000`; header eyebrow `CONFIGURE · {type}` + `✕` `:1001–1003`; footer Cancel/Save `:1032`.

**Interfaces:** the existing `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`/`DialogClose` kit (DialogContent is already `w-full max-w-[460px]` centered with a backdrop).

- [ ] **Step 1: Swap the shell SlideOver → Dialog.** In `EditSolutionSlideOver`, replace `SlideOver`/`SlideOverContent` with `Dialog`/`DialogContent`, keeping the `key={solution.id}` remount:

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-h-[88vh] overflow-y-auto p-0">
    {solution ? (
      <EditSolutionForm key={solution.id} solution={solution} onOpenChange={onOpenChange} />
    ) : null}
  </DialogContent>
</Dialog>
```

Remove the `SlideOver*` imports; add the `Dialog*` imports.

- [ ] **Step 2: Rebuild the header (eyebrow + title + `✕`).** Replace `SlideOverHeader`/`SlideOverTitle` with a bordered header row. Drop the status/archived badges (the prototype's Configure header is eyebrow + name + `✕`; status lives in the directory). Use `DialogTitle` for a11y:

```tsx
<div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-5">
  <div className="flex flex-col gap-[3px]">
    <span className="font-mono text-mono-sm font-semibold tracking-[0.08em] text-[var(--brandink)]">
      CONFIGURE · {TYPE_LABEL[solution.type]}
    </span>
    <DialogTitle className="font-heading text-title font-extrabold tracking-[-0.01em] text-[var(--ink)]">
      {solution.name}
    </DialogTitle>
    <span className="text-small text-[var(--ink2)]">/s/{solution.slug}</span>
  </div>
  <DialogClose
    aria-label="Close"
    className="shrink-0 text-title text-[var(--ink3)] outline-none transition-colors hover:text-[var(--ink)]"
  >
    ✕
  </DialogClose>
</div>
```

(`StatusBadge` is likely now unused in this file — remove its import if so.)

- [ ] **Step 3: Move the form body into the modal + footer actions.** Wrap the fields (currently in `SlideOverBody`) in a `<div className="flex flex-col gap-6 p-5">`. Give the `<form>` an `id="edit-solution-form"` and REMOVE its in-body "Save changes" submit button. Replace `SlideOverFooter` with `DialogFooter` holding Cancel + Save:

```tsx
<DialogFooter>
  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
    Cancel
  </Button>
  <Button type="submit" form="edit-solution-form" size="sm" disabled={isSubmitting || !isDirty}>
    {isSubmitting ? "Saving…" : "Save changes"}
  </Button>
</DialogFooter>
```

The chat `ThemePreview`, chat/embedded config sections, name/description/type fields all stay inside the form unchanged. (`isDirty`/`isSubmitting` come from the form state already in scope.)

- [ ] **Step 4: Verify.** `pnpm typecheck && pnpm lint` clean. Confirm the modal scrolls (long chat config + preview) within `max-h-[88vh]`.

- [ ] **Step 5: Visual + commit.** `verdict` `/admin/solutions` → open Configure on a chat and an embedded solution (centered 460px modal, `CONFIGURE · Chat`/`Embedded` eyebrow, `✕`, scroll, footer Cancel/Save). Then:
```bash
git add src/features/solutions/components/edit-solution-slide-over.tsx
git commit -m "fix(admin-solutions): Configure slide-over -> centered 460px modal + eyebrow/close/footer (ASol-00)"
```

---

## Task 4: Embedded config fields — App URL + Allow fullscreen (ASol-07, honest-hybrid per DEC-C3-B)

**Files:** Modify `src/features/solutions/schemas/solution.ts`, `src/features/solutions/components/edit-solution-slide-over.tsx`, `src/features/solution-viewer/components/embedded-view.tsx`, and the `<EmbeddedView>` render site (grep).

**Prototype refs:** embedded fields `.dc.html:1025–1030` (App URL, Frame Height, Allow fullscreen, Open in a new tab).

- [ ] **Step 1: Schema — add `allowFullscreen`.** In `embeddedConfigSchema`, add `allowFullscreen: z.boolean().optional()` (keep `iframeUrl` as-is). This is additive; the draft seed `{ iframeUrl: "" }` still parses.

- [ ] **Step 2: Configure form — relabel + toggle.** In `EmbeddedConfigFields` (in `edit-solution-slide-over.tsx`): change the `iframe URL` `<Label>` text to **"App URL"** (keep the input + `register("config.iframeUrl")`). Add an "Allow fullscreen" toggle row after it, mirroring the chat `feedbackEnabled` Switch+Controller pattern:

```tsx
<div className="flex items-center justify-between gap-4">
  <Label htmlFor="embed-fullscreen">Allow fullscreen</Label>
  <Controller
    control={control}
    name="config.allowFullscreen"
    render={({ field }) => (
      <Switch
        id="embed-fullscreen"
        name={field.name}
        checked={Boolean(field.value)}
        onCheckedChange={field.onChange}
        onBlur={field.onBlur}
      />
    )}
  />
</div>
```

`EmbeddedConfigFields` must now receive `control` (add it to its props, pass from the form like `ChatConfigFields` does). In `toFormValues`, the embedded branch becomes `{ iframeUrl: …, allowFullscreen: (s.config as { allowFullscreen?: boolean }).allowFullscreen ?? false }`. In `selectType`, the embedded reset becomes `{ iframeUrl: "", allowFullscreen: false }`.

- [ ] **Step 3: Viewer — apply `allowFullscreen`.** In `embedded-view.tsx`, add `allowFullscreen?: boolean` to the props and set it on the iframe conditionally: `allow={allowFullscreen ? "fullscreen" : undefined}`. (Do NOT change the `sandbox` string — fullscreen via `allow=` is independent of the sandbox popup/same-origin tokens.)

- [ ] **Step 4: Thread it from the render site.** Grep `<EmbeddedView`; pass `allowFullscreen={(solution.config as EmbeddedConfig).allowFullscreen}` (or the equivalent already-parsed config field) at that call site.

- [ ] **Step 5: Verify.** `pnpm typecheck && pnpm lint` clean.

- [ ] **Step 6: Commit.**
```bash
git add src/features/solutions/schemas/solution.ts \
        src/features/solutions/components/edit-solution-slide-over.tsx \
        src/features/solution-viewer/components/embedded-view.tsx \
        <the EmbeddedView render-site file>
git commit -m "feat(admin-solutions): embedded App URL label + real Allow fullscreen toggle (ASol-07, honest-hybrid)

Frame Height + separate Open-in-new-tab intentionally omitted (DEC-C3-B):
the embedded viewer is a hardened full-page sandbox that already exposes an
open-in-new-tab control; a fixed frame height fights that design and a fake
control would mislead. Allow-fullscreen is wired for real via iframe allow=."
```

---

## Task 5: Verify branch + execution log

**Files:** Modify `docs/execution-log/index.md`.

- [ ] **Step 1: Full-branch verify.** `pnpm typecheck && pnpm lint` → both clean (only pre-existing `scripts/` warnings).
- [ ] **Step 2: Visual QA sweep.** `verdict` the directory, register dialog, and Configure modal (chat + embedded) at 920/1180/1440; note residual drift.
- [ ] **Step 3: Append the Wave C3 execution-log entry** — findings resolved (ASol-00/01/04/05/06/07/08/09/10), decisions DEC-C3-A (Native kept hidden; ASol-02/03 non-defects), DEC-C3-B (embedded honest-hybrid; Frame-Height + separate new-tab omitted), DEC-C3-C (colgroup not TanStack for the mutation-heavy Solutions table), and any accepted deviations (Configure header status badges dropped for prototype conformance).
- [ ] **Step 4: Commit.**
```bash
git add docs/execution-log/index.md
git commit -m "docs(log): Wave C3 admin Solutions complete — colgroup grid, badge-select, Configure modal, embedded fields"
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** ASol-00 (T3 modal), ASol-01 (T1 colgroup), ASol-04 (T2 input), ASol-05 (T1 avatar), ASol-06 (T1 badge-select), ASol-07 (T4 embedded), ASol-08 (T2 ✕), ASol-09 (T1 type font), ASol-10 (T1 subtitle). ASol-02/ASol-03 → DEC-C3-A documented non-defects. All mapped.
- **Placeholder scan:** none — exact classes/tokens/copy/widths given. The two grep-for-site steps (EmbeddedView render site) are concrete lookups, not placeholders.
- **Type consistency:** `SolutionType`, `SolutionStatus`, `EmbeddedConfig`, `EditSolutionValues`, `Solution` names match their schema definitions; the new `allowFullscreen` is optional across schema/form/viewer.
- **Shared-primitive safety:** kit `Dialog`/`Select` are reused via className/props (no primitive edits); `embedded-view.tsx` gains an optional prop (existing callers unaffected until the render site passes it).
