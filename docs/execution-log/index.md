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
