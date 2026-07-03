# Design Drift Remediation — Wave C1 (Admin → People) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin People directory + edit-person surfaces to prototype parity — rebuild the directory on TanStack Table at the prototype's grid proportions, replace the flat reset/temp-password buttons with the 2-step account-action dialog, and correct the search/add/chip/email/banner/slide-over drift.

**Architecture:** Wave C is the admin console — the heaviest, final wave of the 3-wave remediation (spec: `docs/superpowers/specs/2026-07-02-design-drift-remediation-design.md`), split into 4 area sub-plans (People → Groups/Access → Solutions → Themes). This is **C1: People** (AP-00…AP-11 + AS-01). Waves A & B are merged to `main`. C1 establishes the **TanStack-Table directory pattern** that C2 (Groups) and C3 (Solutions) reuse.

**Tech Stack:** Next.js 16 · Tailwind v4 + shadcn on Base UI · **`@tanstack/react-table` v8.21.3** (already added) · tRPC + zod · better-auth (admin API) · Drizzle. **No unit-test runner** — per-task verification is `pnpm typecheck` + `pnpm lint` + a `verdict` visual check where reachable (admin is behind login → authenticated visual QA largely deferred to human review; diffs checked against the prototype).

## Global Constraints

- **Prototype = screen source of truth:** `docs/design-package/Genie Control Station.dc.html` (People screen ~644-678; add/edit dialog ~1040-1080; account-action dialog ~1142-1190). Static export → `var(--token,#fallback)` renders as the fallback literal (per-usage ground truth).
- **No hard-coded px font-sizes** — always a `--t-*`/`--m-*` token via `text-*`. Reuse existing primitives: `Chip` (`src/components/ui/chip.tsx`), `Button` (`variant="dark"`/`size="sm"` exist), `StatusBadge`, `SlideOverClose` (exists in `slide-over.tsx`, currently unused), and the kit `Table`/`TableHead`/`TableRow`/`TableCell` (Wave A styling — header is `--m-xs` mono uppercase).
- **Honesty (from Wave B):** never ship a control that fakes/no-ops. If the prototype implies a capability the backend lacks, wire it for real or omit it — never a dead toggle/button.
- **Do NOT regress shared primitives.** One-off prototype values (Remove-button error border, banner literals, slide-over width) are scoped via `className` overrides, not shared-variant edits (`cn()` = tailwind-merge; a later arbitrary class wins its conflict group).
- **Scope:** People admin only. Do NOT touch Groups/Access/Solutions/Themes admin (C2/C3/C4) or the customer workspace. Code style: 2-space indent, semicolons, double quotes, trailing commas in multi-line.

## Decisions (confirmed by user 2026-07-03)

- **D1 — AP-01 directory rebuild → TanStack Table (`@tanstack/react-table` v8).** TanStack owns column defs + core/filtered row models; the search input drives its **global filter**. Render via `flexRender` into the kit `Table`/`Table*` components, with the prototype's `fr` proportions supplied by a `<colgroup>` + `table-layout:fixed` (`1.7 .8 1.7 .8 .8 .6` → `26.6% 12.5% 26.6% 12.5% 12.5% 9.4%`), inside the existing `TableScroll` (`min-w-[720px]`, horizontal scroll — matches prototype `min-width:720px;overflow:auto`). This is the pattern C2/C3 reuse.
- **D2 — AP-00 "Require password change" toggle → WIRED.** Add `requireChange: boolean` (default `true`) to the temp-password server path; toggle-off clears `mustChangePassword`. No fake UI.
- **D3 — AS-01 Overview nav → KEEP folded (documented non-defect).** Overview content already exists via the Access mode-toggle; do NOT add a redundant top-level item. Only rename the nav label **"Themes" → "Theme Builder"** (matches the page `<h1>`), and record the fold-in decision in the execution log.

## Dropped / already-resolved (no task)

- **AP-08** (account-active toggle on-color): NOT a defect — every toggle in the design package is brand-on; the `Switch` primitive already matches. Drop as stale.

---

## File Structure

**Created:**
- `src/features/users/components/admin-search-input.tsx` — 32px bordered search composite (AP-02), reusable by C2/C3.

**Modified:**
- `package.json` / `pnpm-lock.yaml` — `@tanstack/react-table` (already added; committed in Task 3).
- `src/features/users/server/{router.ts,user-service.ts}` — `requireChange` param (D2).
- `src/features/users/components/people-directory.tsx` — TanStack rebuild + cells (AP-01, AP-04, AP-05, AP-02 filter wiring), toolbar +Add (AP-03), info banner (AP-11).
- `src/features/users/components/edit-person-slide-over.tsx` — ✕/width (AP-06), account-actions set (AP-07), pending buttons (AP-09), Remove border (AP-10), open the AP-00 dialog.
- `src/features/users/components/temp-password-dialog.tsx` (or new `account-action-dialog.tsx`) — 2-step account-action dialog (AP-00).
- `src/features/users/components/invite-person-dialog.tsx` — ✕/width parity (AP-06 companion; same shared prototype modal).
- `src/app/(admin)/_lib/admin-nav-items.ts` — "Themes" → "Theme Builder" (AS-01).

---

## Task 1: Server — `requireChange` param on temp-password (D2 / AP-00 backend)

**Files:** Modify `src/features/users/server/router.ts`, `src/features/users/server/user-service.ts`.

**Interfaces:** Produces `trpc.users.setTempPassword({ id, requireChange?: boolean })` (default `true`). When `true`, behaves as today (`adminSetTempPassword` → `auth.api.setUserPassword`, sets `mustChangePassword: true`). When `false`, generates a temp password AND clears `mustChangePassword` (wire the existing-but-dead `adminSetPassword`, `user-service.ts`, with a generated value — do not leave it dead).

- [ ] **Step 1:** Add `requireChange: z.boolean().default(true)` to the `setTempPassword` input schema in `router.ts`; pass it to the service.
- [ ] **Step 2:** In `user-service.ts`, thread `requireChange` into `adminSetTempPassword` (add the param) — when `false`, set the generated password with `mustChangePassword` cleared (reuse `adminSetPassword`'s clearing logic or add a flag). Keep the return contract (plaintext-once) unchanged. Confirm no other caller of `adminSetTempPassword` breaks (the `activate:true` path — keep its current behavior by defaulting `requireChange` true).
- [ ] **Step 3:** `pnpm typecheck && pnpm lint` (allow the 5 pre-existing `scripts/` warnings). Commit: `feat(admin-people): requireChange param on setTempPassword (AP-00 backend)`.

---

## Task 2: `AdminSearchInput` composite (AP-02)

**Files:** Create `src/features/users/components/admin-search-input.tsx`.

**Interfaces:** Produces `<AdminSearchInput value onChange placeholder aria-label />` — a controlled 32px bordered search box (prototype `.dc.html:652`), reusable by C2/C3.

- [ ] **Step 1:** Build it: outer `<div className="flex h-8 w-[220px] max-w-[48vw] items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-[10px]">`; leading `<span aria-hidden className="size-[11px] shrink-0 rounded-full border-[1.5px] border-[var(--ink3)]" />`; inner `<input className="w-full border-none bg-transparent font-sans text-small text-foreground outline-none placeholder:text-[var(--ink3)]" />` forwarding `value`/`onChange`/`placeholder`/`aria-label`.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint`. Commit: `feat(admin-people): AdminSearchInput 32px bordered search composite (AP-02)`.

---

## Task 3: People directory rebuilt on TanStack Table — grid proportions + cells (AP-01 P0, AP-04, AP-05, AP-02 wiring)

**Files:** Modify `src/features/users/components/people-directory.tsx`; commit `package.json` + `pnpm-lock.yaml` (the already-added `@tanstack/react-table`).

**Interfaces:** Consumes `AdminSearchInput` (Task 2). This is the core structural task; its column cell renderers define the email/chip cell details, so AP-04 and AP-05 are folded in here.

- [ ] **Step 1: Column defs + table instance.** Define six columns matching the prototype (`.dc.html:657-676`): `user` (avatar + name + email), `role`, `groups`, `lastActive`, `status`, `actions`. Build the table with `useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), state: { globalFilter }, onGlobalFilterChange, globalFilterFn: 'includesString' })` (import from `@tanstack/react-table`). Preserve the existing data source (the tRPC `Person[]` query) — TanStack consumes the already-fetched array; do NOT move data fetching.
- [ ] **Step 2: Wire search → global filter (AP-02).** Replace the current `<Input ... />` search with `<AdminSearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="Search users…" />` driving TanStack's `globalFilter` (filter across name + email + role). If any current role/status `Select` filters exist, keep them (as column filters or pre-filtering the data) — preserve current filtering behavior.
- [ ] **Step 3: Render with `flexRender` + kit Table + colgroup.** Render inside the existing `TableScroll` a `<Table className="min-w-[720px] table-fixed">` with a `<colgroup>` of six `<col style={{ width }}>` at `26.6% 12.5% 26.6% 12.5% 12.5% 9.4%`. Header row via `TableHead` (keeps Wave A `--m-xs` mono uppercase on `--panel`); body via `table.getRowModel().rows.map(...)` + `TableCell` + `flexRender(cell.column.columnDef.cell, cell.getContext())`. ACTIONS header right-aligned.
- [ ] **Step 4: Cell content (folds in AP-04 + AP-05).** In the column cell renderers match the prototype:
  - `user`: 30×30 Archivo-800 mono avatar tile (`bg-[var(--panel)] text-[var(--ink)] text-[10px] font-heading font-extrabold`) + name (`text-body font-semibold` truncate) + email (`text-mono-md text-[var(--ink3)]` truncate — **AP-05**).
  - `role`: `text-small text-[var(--ink2)]`.
  - `groups` (**AP-04**): `flex flex-wrap gap-1` — group-name chips as `<Chip truncate className="max-w-[120px] font-semibold">{name}</Chip>`; a "+N more" chip as inline `<span className="inline-flex items-center rounded-[2px] border border-[var(--line2)] bg-[var(--panel)] px-[6px] py-[2px] font-mono text-mono-md font-semibold text-[var(--ink2)]">+{n} more</span>`; "No groups" as plain `<span className="font-mono text-mono-md text-[var(--ink3)]">No groups</span>` (no chip).
  - `lastActive`: `text-mono-md text-[var(--ink3)]` (**AP-05** sibling).
  - `status`: the existing `StatusBadge` (Wave A) — keep.
  - `actions`: right-aligned "Manage" link `text-[var(--brandink)] text-xs font-semibold` (or the existing action control).
- [ ] **Step 5:** `pnpm typecheck && pnpm lint`. Best-effort visual (auth-gated). Commit (include package files): `feat(admin-people): rebuild directory on TanStack Table at prototype grid proportions (AP-01, AP-04, AP-05)`.

---

## Task 4: Directory toolbar +Add button + info banner (AP-03, AP-11)

**Files:** Modify `people-directory.tsx` (toolbar/banner regions, outside the table).

- [ ] **Step 1: +Add (AP-03).** Change the "+ Add person" `<Button>` to `<Button variant="dark" size="sm" className="px-[14px]">` (ink fill, 32px; prototype `.dc.html:654`).
- [ ] **Step 2: Info banner (AP-11).** Change the "How access works" banner: `border-[var(--brand)]/25` → `border-[#d7e3f6]`, body span `text-[var(--ink2)]` → `text-[#2a4d80]` (prototype literals, `.dc.html:648`); optionally padding `px-[13px] py-[9px]`.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint`. Commit: `fix(admin-people): +Add ink button + info-banner literals (AP-03, AP-11)`.

---

## Task 5: Edit/invite slide-over — close ✕ + 440px width (AP-06)

**Files:** Modify `edit-person-slide-over.tsx` and `invite-person-dialog.tsx` (same shared prototype modal — fix both).

- [ ] **Step 1: Width.** Pass `className="max-w-[440px]"` to `<SlideOverContent>` in both files (local override; `cn()` lets it win over the primitive's `max-w-[420px]` — do NOT change `slide-over.tsx`).
- [ ] **Step 2: Close ✕.** Add a close control to `SlideOverHeader` using the existing `SlideOverClose` export from `slide-over.tsx`: an ink3-colored `✕` at ~`--t-h3`, right-aligned (prototype `.dc.html:1041`). If `SlideOverClose` doesn't render a glyph itself, wrap a `✕` in it.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint`. Commit: `fix(admin-people): edit/invite slide-over ✕ close + 440px width (AP-06)`.

---

## Task 6: 2-step account-action dialog + button collapse (AP-00 P0, AP-07)

**Files:** Rebuild `temp-password-dialog.tsx` (or new `account-action-dialog.tsx`); modify `edit-person-slide-over.tsx` (button set). Consumes Task 1's `requireChange`.

- [ ] **Step 1: The dialog (prototype `.dc.html:1142-1190`).** Centered modal, `max-w-[430px]`, scrim `rgba(8,10,14,.5)`. Header: `ACCOUNT ACTION` mono eyebrow + Archivo-800 "Reset password" + `{name} · {email}` + `✕`. **Step 1 (chooser):** two radio-cards — "Email a reset link" (with a `RECOMMENDED` success-tint tag: `text-[var(--success)] bg-[var(--successtint)] px-[6px] py-[2px]`) and "Set a temporary password"; a "Require password change at next sign-in" `Switch` shown ONLY when temp is selected (drives `requireChange`). Footer: Cancel + Continue. **Step 2 (result, on Continue — call the chosen mutation LAZILY and reflect pending/error):** success `✓`; link branch → "Reset link sent … expires in 60 minutes"; temp branch → revealed password in a mono `--panel` box + Copy. Footer: Done. Reuse `trpc.users.sendResetLink` (link) and `trpc.users.setTempPassword({ requireChange })` (temp) — no new mutations.
- [ ] **Step 2: Button collapse (AP-07).** In `edit-person-slide-over.tsx`, replace the "Email reset link" + "Set temporary password" buttons with one `<Button variant="ghost" size="sm">Reset password</Button>` opening this dialog. Keep "Force sign-out" as-is. Remove the now-unused `handleSetTempPassword`/direct-reveal wiring if it's fully superseded (the dialog owns the temp reveal now).
- [ ] **Step 3:** `pnpm typecheck && pnpm lint`. Commit: `feat(admin-people): 2-step account-action reset dialog + Reset-password button (AP-00, AP-07)`.

---

## Task 7: Pending-card buttons (AP-09)

**Files:** Modify `edit-person-slide-over.tsx`.

Prototype (`.dc.html:1052-1058`): both 30px, `--t-xs`; "Resend invite" white-fill (`bg-surface`) on the amber card; "Mark as active" ink-fill (already `variant="dark"`).

- [ ] **Step 1:** "Resend invite" — add `className="h-[30px] bg-[var(--surface)] text-xs"` (surface fill so it reads on the `--warntint` card; 30px; `--t-xs`). "Mark as active" — keep `variant="dark"`, add `h-[30px] text-xs`. (No global 30px/`--t-xs` Button size — use local `className` overrides; if C2/C3 need the same, note a shared size for follow-up.)
- [ ] **Step 2:** `pnpm typecheck && pnpm lint`. Commit: `fix(admin-people): pending-card buttons 30px + white-fill Resend (AP-09)`.

---

## Task 8: Remove-person button error border (AP-10)

**Files:** Modify `edit-person-slide-over.tsx`.

- [ ] **Step 1:** The "Remove" button (`variant="destructive"`, neutral `--line` border) — add `className="border-[var(--error)]"` (prototype `.dc.html:1080` error-red border). Do NOT change the shared `destructive` variant (it correctly matches "Delete group"/theme-Delete elsewhere).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint`. Commit: `fix(admin-people): Remove-person button error border (AP-10)`.

---

## Task 9: Admin nav label (AS-01, D3)

**Files:** Modify `src/app/(admin)/_lib/admin-nav-items.ts`.

- [ ] **Step 1:** Rename the nav item label `"Themes"` → `"Theme Builder"` (matches `theme-builder.tsx`'s `<h1>`). Do NOT add an Overview item (D3: folded IA kept as documented non-defect).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint`. Commit: `fix(admin): nav label Themes → Theme Builder (AS-01)`.

---

## Task 10: Wave C1 verification + docs

- [ ] **Step 1:** Full `pnpm typecheck && pnpm lint` (allow only the pre-existing `scripts/` warnings).
- [ ] **Step 2:** Visual sweep of `/admin/people` (grid proportions, 32px search, +Add ink, chips, `--m-md` email, banner) + edit-person slide-over (✕, 440px, "Reset password" → 2-step dialog, pending buttons, Remove border) vs prototype — authenticated, likely human QA; note what was/wasn't verified.
- [ ] **Step 3:** Append a `## Wave C1 · Admin People` entry to `docs/execution-log/index.md`: findings resolved (AP-00…AP-11 minus AP-08, AS-01), decisions D1 (TanStack Table)/D2 (requireChange wired)/D3 (Overview folded + documented, Themes→Theme Builder rename), AP-08 dropped as non-defect. Commit.
- [ ] **Step 4:** Report + hand off to C2 (Groups/Access), reusing the TanStack directory pattern (D1) for AG-01.

---

## Out of scope for C1 (later Wave C sub-plans)
- C2 Groups/Access (AG-01…AG-07), C3 Solutions (ASol-00…ASol-10), C4 Themes (AT-00…AT-08). The TanStack directory pattern from Task 3 is the template for AG-01/ASol-01.
