---
kind: spec
title: "Execution Log — accepted deviations"
---

# Execution Log — accepted deviations

Brief record of technically-sound deviations accepted during execution (technical lens). Product-level decisions are unchanged.

## Ticket 01 · Scaffold & infra — Well Implemented

Verified: scope boundaries clean (no Docker/better-auth/schema/component-kit), Ledger tokens wired, `output: 'standalone'`, pre-commit hook installed + runs lint-staged, `oxlint`/`tsc` clean.

Accepted deviations:

- **Fonts via `next/font/google`** (self-hosted Geist/Geist Mono) instead of Ledger `fonts.css` Google-Fonts `@import`; Ledger `--font-*` vars rewired to the next/font vars. Same fonts, faster, no runtime @import. Ledger px token values kept as source-of-truth; no UI hard-codes px.
- **Dark mode on `[data-theme="dark"]`** (Ledger's strategy) via next-themes `attribute="data-theme"`; shadcn's `.dark` class strategy dropped to match.
- **oxfmt 0.57.0 used** (no Prettier substitution) — runs clean, defaults match house style.
- **node-postgres (`pg`) Pool** driver; **next-themes** theming; **no tRPC superjson transformer yet** (plain JSON; add when a procedure needs Date/Map).

Carry-forward (for later tickets):

- **Ticket 02:** re-skin the vendored shadcn `button` (currently default `text-sm`/rem sizing) to Ledger tokens.
- **Ticket 03b (Docker):** build stage should `pnpm install --frozen-lockfile` (no `.git` in the build context; `prepare` is guarded `simple-git-hooks || true`; package manager is **pnpm**, pinned via `packageManager`). sharp postinstall deferred by npm allow-scripts → image-opt is a runtime concern.
- **Env limitation:** no headless Chrome/display, so real-browser DOM checks aren't possible here; client behavior verified via the exact HTTP transport + typed build instead.

## Ticket 02 · Ledger component kit — Well Implemented

Verified: 17 components present; scope clean (no AI Elements/auth/schema/Docker; kitchen-sink preview removed); addendum wired (zustand, `ReactQueryDevtools` dev-gated, react-hook-form + resolvers, AGENTS.md conventions); no hard-coded font px (px present are dimensions/spacing per Ledger recipes); `oxlint`/`tsc` clean.

Accepted deviations:

- Button re-skin resolved the ticket-01 carry-forward (cva → 5 Ledger variants, `rounded-none`, type via `--t-*` utilities added to `@theme inline`).
- **SlideOver built on Base UI `Dialog`** (right-edge) rather than the heavier `Drawer` primitive.
- RHF binding: `Input` native via `register`; `Select`/`Switch` via a documented `Controller` pattern (in `AGENTS.md`).
- Skeleton uses `animate-pulse` (reduced-motion-safe) vs a bespoke shimmer; `Label` carries a scoped a11y disable (standalone primitive); `Spinner` uses `<output>`.
- Editor-only Next TS-plugin hint (71007) on `TransferList` `onChange` — benign; gates clean.

## Ticket 03 · Identity + schema + migrations — Well Implemented

Verified against the critique invariants (agent ran a real DB-backed smoke test against Postgres, all 6 invariant groups passing): all key files present; `expiresIn=FIFTEEN_MINUTES` + `updateAge:0` (true sliding idle) + `cookieCache` off; `adminRoles:["admin"]` multi-role; custom `status` + `mustChangePassword`; `pending` blocked at `session.create.before` (`return u?.status !== "pending"`); `mustChangePassword` enforced at the shared accessor returning `"password-change-required"`; status derived not dual-written; drizzle-kit sole migration owner (no better-auth `migrate`); `oxlint`/`tsc`/`next build` clean.

Accepted deviations / notes:

- **Invite path = reset-link (primary),** verified working for an admin-created unverified user with a generated password; the `adminSetPassword` fallback is implemented in the domain service as the named safety net, not the chosen path.
- **CLI quirk:** `@better-auth/cli generate` can't resolve `server-only`; the agent stripped the `server-only` imports during generation and restored them after. Auth tables are committed (not regenerated at runtime) → one-time authoring step. **Ticket 03b** should `pnpm install --frozen-lockfile` in the Docker build (no `.git`/hooks) and document this.
- `sendResetPassword` logs the link (no email transport in foundation — email/ops is a later slice).
- `updateAge:0` chosen over `disableSessionRefresh` for true sliding idle (verified effective).
- The committed `scripts/smoke-identity.ts` is the invariant test; it needs `tsx` (currently transitive) — consider `pnpm add -D tsx` + a `db:smoke` script.
- **Deferred:** full idle-window timing test across the HTTP surfaces (RSC/tRPC/`/api/chat`) — the accessor is shared so it's a test-harness gap, not an enforcement gap; real email delivery; the `/api/chat` route + admin UI (later tickets).

## Ticket 03b · Docker image & runtime config — Well Implemented

Verified end-to-end: `docker compose up --build` against a **fresh volume** ran the full boot sequence — `parseConfig()` fail-fast → advisory lock → `drizzle-orm migrate` → `bootstrapAdmin` (seeded `admin@example.com` with `mustChangePassword`) → lock released → standalone server → `GET /` = HTTP 200, `/api/health` = `{"status":"ok"}`. `node:24` base, pnpm via Corepack, `--frozen-lockfile --ignore-scripts`, non-root runtime user, secrets via env only.

Accepted deviations / notes:

- **Entrypoint correctness:** the agent held a **dedicated `PoolClient`** for the whole sequence and ran migrate + bootstrap on the _same_ client under a **session-level** `pg_try_advisory_lock` (polled with timeout) — the right fix for the subtle "lock must bind to the backend that runs the DDL" issue; a transaction or pooled connection would have let the lock slip.
- **Entrypoint is esbuild-bundled** (`pnpm build:entrypoint`) and run with `node --conditions react-server` so the `server-only` marker resolves; migrations run via `drizzle-orm/node-postgres/migrator` (no drizzle-kit CLI in the image).
- **Two compose files (intentional):** `docker-compose.yml` (app image + db, prod-shaped) and `docker-compose.dev.yml` (db only, for `pnpm dev` on the host) — added during the pnpm switch. Both use the same `DATABASE_URL` contract.
- `next build` needs env present for page-data collection; the Dockerfile uses throwaway **placeholders** (verified standalone reads `process.env` at runtime — secrets not baked).
- **Env limitation persists:** no headless browser, so real-browser DOM checks still can't run here.

## Review fixup pass — all 11 findings resolved

Cohesive `traycer-review` (3 fresh agents: `review-identity`, `review-ui`, `review-infra`) surfaced 11 findings; all fixed in one pass. Final sweep: `tsc` / `oxlint` / `oxfmt --check` all green across the tree.

Critical:

1. **Password strength on the invite/reset path** — added a better-auth `passwordStrengthPlugin()` (`hooks.before` via `createAuthMiddleware`) enforcing the shared rule on `/reset-password`, `/change-password`, `/set-password`, `/sign-up/email`, `/admin/create-user`, `/admin/set-user-password`; plus `assertStrongPassword` in `adminSetPassword`. Verified by a new weak-reset rejection in the smoke test.
2. **Bootstrap atomicity** — seed in one `createUser` call (`role:["user","admin"]`, `data:{ mustChangePassword:true, status:"active" }`); dropped the follow-up `db.update`.
3. **parseConfig ordering** — `entrypoint.ts` no longer static-imports bootstrap; `parseConfig()` is first, `bootstrapAdmin` is dynamically imported after migrations.
4. **Compose HOSTNAME** — Dockerfile runner sets `HOSTNAME=0.0.0.0` so the `/api/health` healthcheck (localhost) resolves against standalone.

Drift / correctness: 5. `inviteUser` now forwards `headers` to `createUser` (admin-session enforced; bootstrap stays the sessionless exception). 6. `onPasswordReset` scoped to `pending → active` only. 7. Confirm dialog resolves a prior pending Promise as `false` before opening a new one. 8. TransferList prunes stale selections against the current side + dedupes emitted ids. 9. Workspace sidebar reflows to an off-canvas drawer + hamburger + scrim under 920px (reduced-motion safe). 10. Dark `--chrome` fixed to a light ink (`#e7ecf3`) — brand wordmark readable on dark sidebar. 11. `Select` wrapper exposes `name`/`required`/`form` + `onBlur` (via `onOpenChange`) for clean RHF `Controller` binding.

Minor: removed the unused `EXTERNAL_CHAT_API_TOKEN` from app compose + deployment doc (the external chat API is public); `docker-compose.full.yml` comment now shows the `-f` flag; markdown docs reformatted.

Tooling change (user request): git hooks migrated from simple-git-hooks + lint-staged to **lefthook** (`lefthook.yml`, pre-commit: oxfmt → oxlint on staged files; installed via `prepare`). Verified it blocks a lint error.

Review artifacts: `review-identity`, `review-ui`, `review-infra` (findings + validation). Verified-sound items from the reviews: non-root runtime, build env placeholders don't leak, app-only compose runs no Postgres, committed migration matches a fresh `drizzle generate`.

## Wave A · Design-drift foundations & tokens — Well Implemented

Wave A of the 3-wave design-drift remediation (spec: `docs/superpowers/specs/2026-07-02-design-drift-remediation-design.md`; plan: `docs/superpowers/plans/2026-07-02-design-drift-wave-a-foundations.md`). Foundations only — fonts, tokens, hub CSS, per-solution theming data model, and shared UI-kit primitive sizing. Executed via subagent-driven-development (fresh implementer + spec/quality review gate per task). Resolves XF-01/03/04/05/06/08/09/10, HB-01/02/03/04, VW-01. `tsc` + `oxlint` clean across the tree (only 5 pre-existing `no-await-in-loop` warnings in `scripts/`, unrelated).

Shipped: fonts → Archivo + Hanken Grotesk + IBM Plex Mono via `next/font` (family tokens remapped); nullable `accent_color`/`accent_color_invert` columns on `solution` (migration `0003`) plumbed through every Solution mapper; hub table breakpoint 960→920px + `.cs-hubpad` responsive padding ladder; `@keyframes csShimmer` skeleton + slide-over scrim 0.32→0.45; StatusBadge `--m-xs`/3-7px, Table header `--m-xs`+16px cell, card/dialog title tracking -0.02em; new `Chip` primitive; per-solution accent on hub mono tile + side-rail tile (demo seeded); viewer chat-header accent.

Accepted deviations / notes:

- **Foundational `cn()` fix (tailwind-merge class eviction).** While adding `Button size="auth"` (Task 11), review caught that the vendored `cn()` = `twMerge(clsx())` with an unconfigured tailwind-merge classified the app's nine custom `--t-*`/`--m-*` font-size utilities (`text-display/cardhead/title/body/small/mono-xs/mono-sm/mono-md/mono-lg`) into its `text-color` conflict group. Any `cn()` string containing both a custom size utility and a color utility silently dropped one (last-wins) — an **app-wide latent bug** (e.g. default primary buttons were losing `text-small`; `size="auth"` primary buttons would have rendered near-black text on the brand-blue fill). Fixed in `src/lib/utils.ts` via `extendTailwindMerge` registering all nine in the `font-size` group (additive `extend`; verified empirically against `tailwind-merge@3.6.0` — size + color now both survive, standard conflict resolution intact). A follow-up audit of every `@theme inline` utility group confirmed font-size was the only misclassification (color/radius/font-family route to correct groups via prefix). This fix affects every `cn()` call in the codebase.
- **Task 10 (viewer accent) scoped to the chat header only.** Bubble/avatar/send-button accent deferred to Wave B — threading solution context into the generic `ai-elements/message.tsx` primitive was invasive; the plan explicitly permitted this fallback.
- **Dark `--chrome` realigned to the tokens source** (`#0f1319`, matching `tokens/colors.css:54`; was `#e7ecf3` from review-fixup finding #10). Currently **inert** — `--chrome` has no consumer in `src/` or any globals.css rule, so this only re-syncs the token value; the sidebar wordmark no longer derives its color from it.
- **`Button size="auth"` (44px) + `Input inputSize="auth"` (42px) created but unconsumed** — auth-screen adoption is Wave B (plan-scoped); the sizes must exist first.

Open Minor items (for final-review triage, non-blocking): `skeleton.tsx:3-4` carries a stale "animate-pulse" comment (now uses `cs-shimmer`); `input.tsx:8` `InputSize` type is declared but not exported for downstream consumers.

Deferred to Wave B/C (unchanged from plan): all auth-surface consumption (AU-*), hub rail `· updated` (HB-05) + Fullscreen tip card (HB-06), viewer status-page link (VW-02) + bot-bubble shade (VW-03), account trusted-devices (AC-*), and the entire admin console (AP-/AG-/ASol-/AT-, incl. the four P0s).

Verification note: `tsc`/`oxlint` gates run clean; per-task spec+quality reviews passed. Live visual sweep against the prototype at 920/1180/1440 (fonts, hub padding ladder, accent tiles, scrim, badge/table sizing) is left to manual QA — automated pixel-comparison to the prototype `.dc.html` is outside the agent's reliable reach.

## Wave B · Surfaces (auth, hub, viewer, account) — Well Implemented

Wave B of the 3-wave design-drift remediation (plan: `docs/superpowers/plans/2026-07-03-design-drift-wave-b-surfaces.md`). Consumes Wave A's foundations on real surfaces. Executed via subagent-driven-development (fresh implementer + spec/quality review gate per task; 14 implementation tasks). Resolves AU-01…AU-08, HB-05/06, VW-01/03, WS-03, AC-01…AC-04. `tsc` + `oxlint` clean (only the 5 pre-existing `no-await-in-loop` warnings in `scripts/`).

Shipped: auth banner `✓`/`!` glyphs (`form-feedback.tsx`); SOC 2 footer removed; auth inputs 42px / submit buttons 44px via Wave A's `inputSize="auth"`/`size="auth"` (sign-in, forgot, set-new-password, change-password forms — account-settings panel left at 40px per prototype); forgot-password "Resend link" CTA; one show/hide toggle driving both password fields; set-password title "Set a new password"; strength-meter 5px/9px spacing; hub rail sub-line `type · updated` + Fullscreen tip card; per-solution accent threaded to the chat avatar/user-bubble/send button; `--panel-chat` bot-bubble shade (`#f1f3f6` light); theme toggle 30×30; `StatusBadge` `outline` variant + "This device" hairline badge; session sub-line `browser · IP · when`; "Trusted devices & timeout" card; account sub-nav padding `9px 12px`.

Accepted deviations / notes (four prototype-vs-reality adaptations — chosen as honest, lowest-risk defaults):

- **AU-05 — "Resend link", not "Open reset link →".** The prototype's success-screen CTA is a demo fake-router advance; the real app emails a server-tokened link the client can't reconstruct. Shipped an honest primary "Resend link" (re-invokes the existing `requestPasswordReset` via the form's `onSubmit()`), verified live (second `POST 200`).
- **WS-02 — sidebar role label kept real, documented NON-DEFECT.** The app has a binary admin/member role model with no "owner" concept; the prototype's hard-coded "WORKSPACE OWNER" is a single-persona demo artifact. `user-footer.tsx` unchanged (keeps `ADMIN` / `WORKSPACE MEMBER`).
- **AC-01 — "Trusted devices & timeout" card = honest hybrid.** Device-trust ("Remembered devices") has zero backend, so that row is informational with NO button (a no-op "Forget all" would be misleading). "Session timeout" is real: copy shows the true 15-min idle value (`IDLE_TIMEOUT_MINUTES` mirrors `idle-timeout.tsx` `SESSION_MS`); no "Preview" button because `idle-timeout.tsx` exposes no callable trigger. No fake/no-op interactive elements ship.
- **AC-02 — session sub-line `browser · IP · when`.** No geolocation exists (only `userAgent` + `ipAddress`), so the prototype's "location" segment is replaced by the IP (browser parsed from UA via an extracted `browserName()` reused by `deviceLabel()`).

Verified already-done (no task this wave): HB-07 (recent/favorites 16px row padding — from `4fc21fc`), VW-02 (down-status "View status page ↗" CTA — from ticket 23).

Open Minor items (for final-review triage, non-blocking): `NoticeBanner` lacks `role="status"` (pre-existing a11y); forgot-password resend depends on the email field never being `reset()`; show/hide toggle could add `aria-pressed`; strength-meter `mt-[3px]` couples to the consumer's `gap-1.5` (plan-authorized); `message.tsx`/`prompt-input.tsx` accent branch spreads `...style` last (latent footgun, no live bug); `IDLE_TIMEOUT_MINUTES` duplicates `idle-timeout.tsx`'s 15-min value with a sync-comment (suggest exporting `SESSION_MINUTES`).

Verification note: `tsc`/`oxlint` clean; per-task spec+quality reviews passed; `/login` re-verified live post-wave (42px inputs, 44px full-width brand CTA, no SOC 2 footer). Authenticated surfaces (hub rail, viewer chat, account) are behind the login wall with no test credentials in-session, so their live visual QA is deferred to a human — the diffs were reviewed against the prototype `.dc.html` values instead. Wave C (the entire admin console) is the next and final plan.

## Wave C1 · Admin → People — Well Implemented

Wave C1 (People) of the admin console (heaviest wave; plan: `docs/superpowers/plans/2026-07-03-design-drift-wave-c1-admin-people.md`). Wave C is split into 4 area sub-plans (People → Groups/Access → Solutions → Themes); this is the first. Executed via subagent-driven-development (fresh implementer + spec/quality review gate per task; 9 implementation tasks + fixes). Resolves AP-00…AP-11 (minus AP-08) + AS-01. `tsc` + `oxlint` clean (only the 5 pre-existing `no-await-in-loop` warnings in `scripts/`).

Shipped: **People directory rebuilt on TanStack Table** (`@tanstack/react-table` v8) at the prototype grid proportions (`colgroup` + `table-fixed`, `26.6/12.5/26.6/12.5/12.5/9.4%`) with search wired to the client `globalFilter`; GROUPS cell → sans `Chip` + mono "+N more" + plain "No groups"; email/last-active → `--m-md`; `AdminSearchInput` 32px composite; ink "+ Add person"; info-banner literals (`#d7e3f6`/`#2a4d80`); edit/invite slide-over ✕ close + 440px; the **2-step account-action reset dialog** (chooser → result, both branches real mutations, `requireChange` toggle wired server-side); pending-card buttons 30px/white-fill; Remove-person error border; nav label "Themes"→"Theme Builder".

Decisions:
- **D1 — directory on TanStack Table** (user choice). Headless table (column defs + core/filtered row models) rendered through the kit `Table` via `flexRender`, with `fr` proportions from a `colgroup`. Establishes the pattern C2/C3 reuse. Search moved server→client `globalFilter` — verified non-regressive because `listPeople` fetches the full roster (no pagination).
- **D2 — `requireChange` wired for real** (not a UI-only toggle): `setTempPassword({ requireChange })` clears `mustChangePassword` on the toggle-off path via the previously-dead `adminSetPassword`.
- **D3 — Overview nav kept folded** (documented non-defect, like AS-02: the Overview explorer already exists via the Access screen's mode-toggle); only the "Theme Builder" rename applied.

Dropped: **AP-08** (account-active toggle on-color) — not a defect; every toggle in the design package is brand-on and the `Switch` primitive already matches.

Notable review catches (fixed): a **Critical race** in the account-action dialog (step-2 result branch read live `method` during the pending mutation → could show "Reset link sent" while a temp password was set and lost) — fixed by pinning the invoked branch, disabling inputs, and blocking close while pending (verified at the Base UI `openProp` level). A brief-level `text-xs` mistake (Tailwind's fixed `0.75rem` ≠ the responsive `--t-xs` token; `--t-xs`===`--t-sm`) — corrected to `text-small` across the touched call sites.

Open Important (follow-up, non-blocking): the app's tRPC client has **no request timeout**, so the account-action dialog's (correct) close-block-while-pending means a truly-hung mutation would leave it unclosable (reload-only) — a systemic `AbortSignal`/timeout fix, not an inline patch. Minor: dim the dialog ✕ while pending; email/last-active weight-500 (pre-existing codebase-wide gap); non-transactional writes in an unreachable `requireChange:false + activate` combo.

Verification: `tsc`/`oxlint` clean; per-task spec+quality reviews passed (the two P0s — the TanStack rebuild and the 2-step dialog — got focused adversarial review). **Dev-env note:** live-testing the account-action dialog reset the seeded local admin's password + set `mustChangePassword`, so local admin login is broken until restored (`pnpm db:dev:reset` or a password reset). Authenticated `/admin/people` visual QA vs the prototype is deferred to a human. Next: Wave C2 (Groups/Access), reusing the TanStack directory pattern.

## Wave C2 · Admin → Groups / Access — Well Implemented

Wave C2 (Groups/Access) of the admin console (plan: `docs/superpowers/plans/2026-07-03-design-drift-wave-c2-admin-groups.md`). Second of Wave C's four area sub-plans. Executed via subagent-driven-development (fresh implementer + spec/quality review gate per task; 3 implementation tasks + inline verify). Resolves AG-01…AG-07. `tsc` + `oxlint` clean (only the 5 pre-existing `no-await-in-loop` warnings in `scripts/`).

Shipped: **Groups directory rebuilt on TanStack Table** at the prototype's `2.6fr .9fr 40px` proportions (`colgroup` + `table-fixed` with `calc((100% - 40px) * 26/35 · 9/35 · 40px)`, so the chevron column stays a fixed 40px at any width); 32px `AdminSearchInput` (promoted to the kit) + ink-filled `+ New group` (`variant="dark" size="sm"`); group description → sans `text-small`. Shared `TransferList` panes → `h-[clamp(380px,52vh,640px)]` with a 24px (`gap-6`) inter-pane gap and header quick-links "Add all shown →" / "Revoke all"; the group-inspector Members list keeps its own prototype dims (`max-h-[300px]`, `gap-2.5`, no quick-links) via new opt-out props. Access overview: people-reached `StatusBadge` → sans `Chip`; by-solution right-side badge → mono type pill (`CHAT`/`NATIVE`/`EMBED` on brandtint).

Decisions:
- **D1-C2 — directory conforms to the prototype's 3-column grid** (`GROUP / MEMBERS / 40px chevron`). The prior build had a 4th "Solutions" count column the prototype doesn't have; conformance **drops it from the directory row**. The grant count remains visible in the group inspector ("N GRANTED") and throughout Access, so no product information is lost — only that one at-a-glance cell. Reversible if the count is wanted back in the row.
- **D2-C2 — Groups search stays server-side** (`useGroupsQuery(search)`); TanStack is used for the column model + `flexRender` + `colgroup` only (no client `globalFilter`). AG-02 was a visual swap of the input/button, not a search-architecture change (unlike C1 People, whose full-roster fetch justified a client filter).
- **D3-C2 — `AdminSearchInput` promoted to the kit** (`src/features/users/components/` → `src/components/ui/`). It is a generic admin primitive with no users-domain logic, now shared by People + Groups (+ Solutions in C3); the move prevents cross-feature imports. Its one existing consumer (People) had its import updated in the same commit.

Notable: the plan's `TransferList` task (AG-05) had an **internal contradiction** — its Step 2 wired the header quick-links unconditionally *inside* `TransferList` (the handlers close over `TransferList`'s own state, so they can't be consumer-supplied), while its Step 3 prose claimed the inspector Members list would automatically omit them. Left literal, the quick-links would have leaked into the Members consumer. The implementer caught this and resolved it with an additive `showHeaderActions?: boolean` prop (default `true`, `false` on the Members call site); the reviewer independently confirmed the plan's assumption was wrong and the fix sound. Similarly, AG-07's data plumbing required adding `type` in **two** places in `overviewBySolution` (the `.select()` *and* the explicit return-object literal — the plan assumed the selected row was spread; it isn't), verified required by both implementer and reviewer.

Accepted deviations / notes:
- **AG-01 — Solutions column dropped** (D1-C2 above): the single deliberate content change of this wave, flagged for the checkpoint.
- **`AdminSearchInput` width** is `220px / 48vw` (built to the People prototype `.dc.html:652`); the Groups prototype draws its search box at `240px / 50vw`. As a now-shared component it uses the single (People) width — a ~20px/2vw difference judged negligible; pre-existing from C1, not re-litigated here.
- **`native` solution type:** the by-solution pill maps over the full DB enum `chat | native | embedded` (the app's `SolutionType` schema type deliberately excludes `native` as an enum-only/hidden kind), so `NATIVE` renders correctly if such a solution ever appears; current seed data is all `embedded`, so `CHAT`/`NATIVE` were verified sound-by-construction (exhaustive map) rather than exercised live.

Verification: `tsc`/`oxlint` clean; per-task spec+quality reviews passed (the P0 grid rebuild got focused review). Per-task `verdict` visual checks were run against the now-restored local admin login (`admin@example.com` / `Sup3rSecret!pw` — a new `pnpm reset-admin` dev script restores it in place without wiping the volume, superseding the C1 dev-login-broken note). A consolidated authenticated sweep at 920/1180/1440 is still recommended for human QA. Next: Wave C3 (Solutions), reusing the TanStack directory pattern + the Configure-modal P0.

## Wave C3 · Admin → Solutions — Well Implemented

Wave C3 (Solutions) of the admin console (plan: `docs/superpowers/plans/2026-07-03-design-drift-wave-c3-admin-solutions.md`). Third of Wave C's four area sub-plans. Executed via subagent-driven-development (fresh implementer + spec/quality review gate per task; 4 implementation tasks + inline verify). Resolves ASol-00/01/04/05/06/07/08/09/10. `tsc` + `oxlint` clean (only the 5 pre-existing `no-await-in-loop` warnings in `scripts/`).

Shipped: **Solutions directory** at the prototype's `1.5fr .5fr .9fr 1.6fr` proportions (`colgroup` + `table-fixed`, `min-w-[880px]`), 30px borderless Archivo monogram, uppercase-mono type label (`CHAT`/`EMBED`), a single tone-styled status **badge-select** (replacing the badge + separate dropdown), and the added subtitle removed. **Register dialog:** single-line description input + a header `✕`. **Configure surface** rebuilt from a right-edge slide-over into the prototype's **centered 460px modal** (reusing the kit `Dialog`, already 460px) with a `CONFIGURE · {type}` eyebrow, `✕`, scrollable body, and a `DialogFooter` Cancel/Save (the Save button sits outside the `<form>` and submits it via `form="edit-solution-form"`). **Embedded config:** "iframe URL" → "App URL" + a real "Allow fullscreen" toggle wired end-to-end (schema → Configure form → viewer surface → iframe `allow="fullscreen"`).

Decisions:
- **DEC-C3-A — Native stays hidden (ASol-02/03 = documented non-defects).** The app deliberately makes `native` an enum-only, unregisterable, catalogue-hidden type (`solutionTypeSchema = z.enum(["chat","embedded"])`; `solutions.list` never returns native rows). Surfacing it in the filter + Register (as the prototype does) would require widening the data model for a type the tech-plan says is never granted/openable. Left hidden, like AS-02. **Overridable** — if native should become manageable, that's a separate data-model task.
- **DEC-C3-B — Embedded config = honest-hybrid (ASol-07).** The prototype's embedded fields are static mockups, and the app's embedded viewer is a security-hardened full-page sandbox (`sandbox="allow-scripts allow-forms"`) that already exposes an open-in-new-tab control. So: shipped "App URL" + a **real** "Allow fullscreen" toggle (wired to the iframe `allow=`, sandbox unchanged); **omitted** "Frame Height" (a fixed height fights the full-page viewer) and a separate "Open in a new tab" toggle (the viewer already offers it, and a fake control would mislead — the AC-01 no-fake-controls ethos).
- **DEC-C3-C — Solutions directory uses a `<colgroup>`, not a TanStack rewrite.** Unlike People/Groups, this table has per-row mutations (status/duplicate/archive/delete, per-row `busy`) and already does server-side search + sort, so TanStack would add no functional benefit and force lifting all row actions to table level. A `<colgroup>` satisfies ASol-01's column-proportion finding while preserving per-row mutation isolation. (D1's TanStack pattern remains the choice for the filter-driven People/Groups directories.)

Accepted deviations / notes:
- **Configure header keeps a `/s/{slug}` line** the prototype's Configure header omits — a low-emphasis, useful carry-over of the slug (relevant for embed URLs); reviewer-endorsed as keep.
- **Status badge-select renders mixed-case** ("Ready"/"Draft"), matching the prototype's select (an initial `uppercase` from the plan was corrected in review).
- **Configure header drops the status/archived badges** (prototype header is eyebrow + name + `✕`); status remains in the directory's badge-select.

Notable review catches (fixed): the status badge-select shipped `uppercase` per the plan but the prototype is mixed-case → corrected. The new Configure `✕` had `outline-none` without a `focus-visible` ring (unlike the sibling dialogs) → a keyboard-focus a11y regression, fixed by adding `focus-visible:ring-2 focus-visible:ring-ring`. A harness LSP false-alarm ("Cannot find name SlideOver*") during the modal rebuild was verified stale — the committed file was `tsc`-clean.

Verification: `tsc`/`oxlint` clean; per-task spec+quality reviews passed (the two P0s — the colgroup grid and the Configure modal — plus the security-sensitive iframe `allow=` change got focused review confirming the `sandbox` string is byte-unchanged). Per-task `verdict` visual checks ran against the restored local admin login. A consolidated authenticated sweep at 920/1180/1440 is recommended for human QA. **Dev-env note:** `ALLOWED_IFRAME_ORIGINS` is unset locally, so embedded-solution *saves* hit an (expected, unrelated) server validation error — the Configure form wiring itself is verified. Next: Wave C4 (Themes), including the P0 dark CSS-editor mock.

## Wave C4 · Admin → Themes — Well Implemented (spec COMPLETE)

Wave C4 (Themes) of the admin console (plan: `docs/superpowers/plans/2026-07-03-design-drift-wave-c4-admin-themes.md`) — the **final** area sub-plan. Executed via subagent-driven-development (fresh implementer + review gate per task; 3 implementation tasks + inline verify). Resolves AT-00/02/03/04/05/06/07/08. `tsc` + `oxlint` clean (only the 5 pre-existing `no-await-in-loop` warnings in `scripts/`). **This completes the entire 3-wave design-drift remediation** (Wave A foundations, Wave B surfaces, Wave C admin console C1–C4).

Shipped: selected theme **pill** → brand border + brandtint + ink text + 12px swatch (was inverted-ink/10px); color **swatches** → 26px with a double-ring (2px white gap + ink/line ring, no `border-2`/scale); the Custom-CSS editor **dark-styled** (`#0f1319`/`#cdd6e3` mono, 1.7 line-height) while staying a fully functional editor; editor **tabs** → equal-width, 10px padding; **preset cards** → flex-wrap min-118px, 700 label; radius presets → 4/12/20; font options → Hanken/Archivo/Mono/Serif; live-**preview chrome** → 32px "A" avatar + "Sample Assistant" + "Preview · {theme}" labels, 82% bubbles, 470/320 device widths.

Decisions:
- **DEC-C4-A — AT-00 dark-styles the FUNCTIONAL CSS editor, not a mock.** The prototype's CSS tab is an explicitly presentational stack of `<div>`s ("Editor is presentational in this prototype.", a static caret, fake syntax colors). The app's Custom-CSS is a real editor (`register("config.customCss")`, applied to the scoped preview). Conformance = the prototype's dark aesthetic on the real `<textarea>`; the "presentational" note, fake caret, and syntax highlighting are intentionally not replicated (they'd be false, or need a code-editor dependency). No fake controls — the AC-01 ethos. Verified the editor stays typable (typing live-updates the preview).
- **DEC-C4-B — AT-01 theme switching = documented non-defect.** Switching via `router.push('/admin/themes/[id]')` is a Next **soft** client navigation (no full reload) and `ThemeBuilderEditor key={id}` remounts against the new theme — functionally the prototype's in-place swap. The spec's "full reload" characterization is stale. Kept as-is, like AS-02.
- **AT-05 font enum values kept stable (no migration).** Existing themes store `font` as a zod enum (`system`/`serif`/`mono`/`rounded`); labels + stacks were repointed to the app's real fonts (Hanken/Archivo/Mono/Serif) and reordered to the prototype order, but the value ids stay stable so stored themes keep parsing.

Accepted deviations / notes:
- **Preview-iframe font fidelity:** the preview is a `sandbox=""` iframe (a deliberate CSS-scoping choice) that can't load the app's `next/font` faces, so "Hanken"/"Archivo" render as a system fallback **in the admin preview only** — the real chat surface (which loads the fonts) renders them correctly. `PREVIEW_HEIGHT` stays a fixed 560px because `sandbox=""` blocks the script an auto-height would need.
- **CSS-editor mock artifacts omitted** (presentational note, static caret, syntax highlighting) per DEC-C4-A.

Notable review coverage: the P0 (AT-00) was checked specifically to confirm the CSS editor was NOT regressed to a read-only mock (it stays a functional `register`-bound textarea); the new user-authored theme `name` interpolated into the preview `srcDoc` was confirmed HTML-escaped (`escapeHtml`) — no injection, with `sandbox=""` as defense-in-depth.

Verification: `tsc`/`oxlint` clean; per-task spec+quality reviews passed; the P0 got focused review. Per-task `verdict` visual checks ran against the restored local admin login. A consolidated authenticated sweep at 920/1180/1440 is recommended for human QA. **The design-drift spec (`docs/superpowers/specs/2026-07-02-design-drift-remediation-design.md`) is now fully implemented across Waves A / B / C1 / C2 / C3 / C4.**

## Post-spec follow-up · Theme Builder CSS editor → CodeMirror

At the owner's request, the Theme Builder's Custom-CSS field (AT-00) was upgraded from the dark-styled `<textarea>` to a real **CodeMirror** editor (`@uiw/react-codemirror` + `@codemirror/lang-css`) — syntax-highlighted CSS on the same `#0f1319` dark surface, bound to react-hook-form via a `Controller` on `config.customCss` (stays fully functional: edits flow to the live preview + enable Save). Notes: `theme="dark"` layers CodeMirror's `oneDark` chrome *after* caller extensions, so the custom `#0f1319` theme is wrapped in `Prec.highest(...)` to win the cascade; and since CodeMirror isn't a native input, screen-reader labelling is done via `EditorView.contentAttributes.of({ "aria-label": "Custom CSS" })` (the old `<Label htmlFor>` no longer associates). No `dynamic(ssr:false)` boundary was needed (verified: no hydration/console errors). Merged + pushed.

## Accepted non-issues (owner decision — no action)

The following were flagged during the design-drift work and **explicitly dismissed by the owner as non-issues**; they are intentionally NOT tracked as tickets or follow-ups. Recorded here so they aren't re-raised:

- **No app-wide tRPC request timeout.** The account-action dialog (Wave C1, `account-action-dialog.tsx`) correctly blocks close while a mutation is pending; a *truly hung* mutation could therefore trap the dialog until reload, because the tRPC client has no request-level `AbortSignal`/timeout. A systemic client timeout was proposed as a follow-up ticket — **dismissed; not ticketing.**
- **Working-tree noise.** The repo working tree carries pre-existing, uncommitted drift — `drizzle/meta/0003_snapshot.json` + `drizzle/meta/_journal.json` (cosmetic migration-meta drift) and assorted `docs/tickets/*` edits (incl. `docs/tickets/09-admin-themes/index.md`) — that predate this remediation and were never staged by any wave. **Dismissed; leave untouched** (no wave will stage or "fix" them).

## Post-spec QA · Consolidated authenticated visual sweep (2026-07-03)

Ran the recommended consolidated authenticated `verdict` sweep of the admin console against the prototype (`docs/design-package/Genie Control Station.dc.html`), logged in as `admin@example.com`, at 920 / 1180 / 1440. Surfaces swept: People directory; Groups directory + group inspector slide-over; Access grants + overview (both "Who can open a solution?" / "What can a person open?" sub-modes); Solutions directory + register dialog + Configure modal (embedded **and** chat config sections, verified by switching the type selector); Themes builder (Presets / Elements / Custom CSS tabs, swatches, radius + font segmented controls, preset cards, Desktop/Mobile live preview, and the new CodeMirror CSS editor).

**Result: one drift found and fixed; everything else conforms.**

- **QA-DRIFT-01 (fixed, `517ba02`) — Solutions "+ Add" button variant/size.** The Solutions directory header `+ Add` rendered as the default brand-primary `h-10` button, but the prototype styles it `background:var(--ink)` `height:32px` — identical to People `+ Add person` and Groups `+ New group`. Applied `variant="dark" size="sm" className="px-[14px]"` to the header button only (`solutions-directory.tsx:108`); the empty-state CTA keeps the default brand variant, matching the Groups empty-state pattern (`groups-directory.tsx:179`). Verified via computed styles (`bg rgb(20,22,27)` = `--ink`, `height 32px`, white text). `tsc`/`oxlint` clean; merged + pushed to `main`.

Confirmed conformant (no action): all directory tables scroll horizontally under their `min-w`/`TableScroll` wrappers at 920 rather than crushing columns (People/Solutions); the group inspector correctly hides per-pane transfer-list quick-links (`showHeaderActions={false}`) while the Access transfer list keeps them; the register dialog's DESCRIPTION is single-line; the Configure modal scrolls internally (`max-h-[88vh]`) and swaps embedded↔chat config sections; the CodeMirror CSS editor is dark-themed, syntax-highlighted, brand-focus-outlined, and dirties the form (Save enables) on edit; Themes stacks to one column at 920. **The `"1 groups"` copy in the Access overview is NOT drift** — the prototype itself always renders `people`/`groups` plural; the repo matches on groups and additionally singularizes person/people, so it is at parity-or-better with ground truth. No change.
