# Design Drift Remediation — Wave B (Surfaces: auth, hub, viewer, account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the visible surface-level drift between the prototype and the app on the auth screens, solutions-hub side rail, solution viewer chat, workspace shell, and account pages — consuming the primitives Wave A already shipped and matching the prototype's exact values.

**Architecture:** This is Wave B of a 3-wave remediation (spec: `docs/superpowers/specs/2026-07-02-design-drift-remediation-design.md`). Wave A delivered the foundations (fonts, tokens, `.cs-hubpad`, `Chip`, per-solution accent columns, `Button size="auth"` / `Input inputSize="auth"`, the `cn()`/tailwind-merge fix). Wave B consumes those on real surfaces. It deliberately does **not** touch the admin console (People/Groups/Solutions/Themes) — that is Wave C. Where the prototype assumes data the app does not have (a client-reconstructable reset link, an "owner" role, remembered-device trust, IP geolocation), Wave B adapts honestly rather than shipping misleading UI — see **Decisions Adopted**.

**Tech Stack:** Next.js 16 (app router) · Tailwind v4 + shadcn on Base UI · `next/font/google` · React Hook Form + zod · `class-variance-authority` · `oxlint`/`oxfmt` · tRPC. **No unit-test runner is configured** — per-task verification is `pnpm typecheck` + `pnpm lint` + a visual check against the prototype (`docs/design-package/Genie Control Station.dc.html`) using `verdict`. Every task uses that cycle (not a hypothetical test framework).

## Global Constraints

- **Prototype is the screen source of truth:** `docs/design-package/Genie Control Station.dc.html`. Match its exact values. Note the prototype is a static export whose dynamic `themeVars()` never fires, so every `var(--token, #fallback)` renders as its literal fallback — the fallback literals are the per-usage ground truth (and are not internally consistent across usages).
- **Fonts:** Archivo = `--font-display` / `font-heading` (headings, initials, glyphs, wt 800); Hanken Grotesk = `--font-ui` / `font-sans` (UI/body/inputs); IBM Plex Mono = `--font-mono` (labels/counts). Never hard-code px font sizes — always a `--t-*` / `--m-*` token via a `text-*` utility. (px heights/paddings via Tailwind utilities are fine.)
- **Auth control sizes (Wave A primitives, consume verbatim):** `Button size="auth"` = `h-11` (44px) + `text-title`; `Input inputSize="auth"` = `h-[42px]` (42px) + `text-title`. The account-settings "Security" panel (`change-password-panel.tsx`) is prototype 40px/`--t-body` and MUST stay on the default sizes — do not touch it.
- **Brand `#2360c4`** reserved for primary action + selection + focus ring. Per-solution accent (`solution.accentColor` / `accentColorInvert`, both nullable) tints only the viewer chat surface, falling back to `var(--brand)` / `var(--onbrand)` when null.
- **`cn()` is fixed** (Wave A): custom `--t-*`/`--m-*` font-size utilities no longer evict text-color classes. You may combine e.g. `text-title` + a color class freely.
- **Code style:** 2-space indent, semicolons, double quotes, trailing commas in multi-line objects/arrays.
- **Commit often:** one commit per task, conventional-commit messages (`fix(auth):`, `feat(hub):`, etc.).
- **Out of scope for Wave B:** the entire admin console (AP-/AG-/ASol-/AT- findings, incl. the four P0s) → Wave C. Also out: WS-05 drag-reorder persistence (separate follow-up).

## Decisions Adopted

These four resolve prototype/reality mismatches. They were selected as the honest, lowest-risk defaults (user was away at planning time) — **overridable**; if reversed, only the noted task changes.

- **AU-05 (forgot-password CTA):** the prototype's "Open reset link →" is a demo fake-router advance; the real app emails a server-tokened link the client cannot reconstruct. → Ship an honest **"Resend link"** primary CTA (re-requests the reset email) instead. (Task 4.)
- **WS-02 (sidebar role label):** the app has a real binary role model (admin vs member); there is no "owner" concept in the schema. The prototype's hard-coded "WORKSPACE OWNER" is a single-persona demo artifact. → **Keep the current real role-based label** (`ADMIN` / `WORKSPACE MEMBER`). WS-02 is a **documented non-defect — no code task.**
- **AC-01 (trusted-devices card):** "Remembered devices" has no backend (device-trust isn't implemented); "Session timeout" has a real mechanism (`idle-timeout.tsx`). → **Honest hybrid**: build the card, wire the timeout row to the real idle-timeout, render "Remembered devices" as informational (no fake "Forget all" action). (Task 13.)
- **AC-02 (session sub-line):** the app has no geolocation (only `userAgent` + `ipAddress`). → sub-line reads **`browser · IP · when`** (browser parsed from UA; keeps the IP security signal). (Task 12.)

## Verified already-done (no task — do not re-implement)

- **HB-07** (recent/favorites row 16px padding): resolved — rows use `.cs-trow` (`solution-list-row.tsx:134,143`), which got `padding:16px;border-bottom:1px solid var(--line2)` in `globals.css` via commit `4fc21fc`.
- **VW-02** (down-status "View status page ↗" CTA): resolved — `status-notice.tsx` down-branch renders both "← Back" and the brand external CTA (commit `e8fa105`, ticket 23).

---

## File Structure

**Modified:**
- `src/components/ui/form-feedback.tsx` — `NoticeBanner`/`FormError` gain glyphs + prototype padding/layout (AU-03).
- `src/app/(auth)/layout.tsx` — remove the SOC 2 footer + fix stale comment (AU-04).
- `src/app/(auth)/_components/sign-in-form.tsx` — `inputSize="auth"` (×2) + `size="auth"` (AU-01/02).
- `src/app/(auth)/_components/forgot-password-form.tsx` — `inputSize="auth"` + `size="auth"`; "Resend link" success CTA (AU-01/02/05).
- `src/app/(auth)/_components/set-new-password-form.tsx` — `inputSize="auth"` (×2) + `size="auth"`; show/hide toggle (AU-01/02/06).
- `src/app/(auth)/_components/change-password-form.tsx` — `inputSize="auth"` (×3) + `size="auth"` (AU-01/02).
- `src/app/(auth)/set-password/page.tsx` — title copy "Set a new password" (AU-07).
- `src/components/ui/password-strength-meter.tsx` — bar/label spacing (AU-08).
- `src/features/solutions-hub/components/solutions-hub.tsx` — rail sub-line `typeLabel · updated` + Fullscreen tip card (HB-05/06).
- `src/components/ai-elements/message.tsx` — optional accent props on `MessageContent`/`MessageAvatar`; chat-bubble token (VW-01/VW-03).
- `src/components/ai-elements/prompt-input.tsx` — optional accent on `PromptInputSubmit` (VW-01).
- `src/features/chat/components/chat-conversation.tsx` — thread `accentColor`/`accentColorInvert` (VW-01).
- `src/features/solution-viewer/components/chat-slot.tsx` — pass accent into `ChatConversation` (VW-01).
- `src/app/globals.css` — add `--panel-chat` token (VW-03).
- `src/components/theme-toggle.tsx` — 30×30, `--t-body`, sans glyph (WS-03).
- `src/components/ui/status-badge.tsx` — add `variant: "solid" | "outline"` (AC-03).
- `src/app/(workspace)/account/_components/sessions-panel.tsx` — "This device" outline badge, sub-line, trusted-devices card (AC-03/02/01).
- `src/app/(workspace)/account/page.tsx` — sub-nav padding (AC-04).

**Created:** none (all changes modify existing files).

---

## Task 1: Auth banner glyphs + padding (AU-03)

**Resolves:** AU-03.

**Files:**
- Modify: `src/components/ui/form-feedback.tsx`

**Interfaces:**
- Produces: `NoticeBanner`/`FormError` unchanged props (`message`), new visual (glyph + layout). Consumed by auth + account forms — no API change.

- [ ] **Step 1: Add glyphs + prototype layout to the two banners**

In `src/components/ui/form-feedback.tsx`, replace the `FormError` and `NoticeBanner` function bodies. Prototype: success banner `display:flex;align-items:flex-start;gap:8px;padding:9px 11px` with an Archivo-800 `✓` prefix (`.dc.html:121`); error banner `display:flex;align-items:center;gap:7px;padding:8px 10px` with an Archivo-800 `!` prefix (`.dc.html:128`). `font-heading` maps to Archivo (globals.css `@theme inline`). Keep the existing tone colors/borders and `text-small` size.

```tsx
/** Form-level error banner (failed submit). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-[7px] border border-[var(--error)] bg-[var(--errortint)] px-[10px] py-2 text-small text-[var(--error)]"
    >
      <span aria-hidden className="font-heading font-extrabold leading-none">
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

/** Success / info banner (e.g. "password reset" notice returned to sign-in). */
export function NoticeBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 border border-[var(--success)] bg-[var(--successtint)] px-[11px] py-[9px] text-small text-[var(--success)]">
      <span aria-hidden className="font-heading font-extrabold leading-none">
        ✓
      </span>
      <span>{message}</span>
    </div>
  );
}
```

Leave `FieldError` unchanged.

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/form-feedback.tsx
git commit -m "fix(auth): add ✓/! glyphs + prototype padding to form-feedback banners"
```

---

## Task 2: Remove the SOC 2 footer (AU-04)

**Resolves:** AU-04.

**Files:**
- Modify: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Delete the SOC 2 footer + fix the stale comment**

In `src/app/(auth)/layout.tsx`, delete the `<footer>…SOC 2 TYPE II…</footer>` element (the block at ~lines 51-60 rendering `font: "600 var(--m-sm) var(--font-mono)"`, `SOC 2 TYPE II`). The prototype's auth block has no trailing footer (grep `.dc.html` for "SOC" → zero matches). Also correct the file's top-of-file comment (lines 1-3) that claims the prototype has "a SOC 2 caption below" — remove that clause so the comment matches reality.

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Visual check**

`verdict goto http://localhost:3000/login` then `verdict snapshot -i`. Confirm no "SOC 2 TYPE II" line below the card.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/layout.tsx"
git commit -m "fix(auth): remove non-prototype SOC 2 TYPE II footer from auth layout"
```

---

## Task 3: Apply auth control sizes (AU-01, AU-02)

**Resolves:** AU-01, AU-02.

**Files:**
- Modify: `src/app/(auth)/_components/sign-in-form.tsx`, `forgot-password-form.tsx`, `set-new-password-form.tsx`, `change-password-form.tsx`

**Interfaces:**
- Consumes: `Input` `inputSize="auth"` and `Button` `size="auth"` (Wave A).

**Note on scope:** `change-password-form.tsx` (the forced full-page change screen) shares the auth-card chrome, so it gets the auth sizes for visual consistency with its siblings. Do NOT touch `account/_components/change-password-panel.tsx` (account-settings inline panel — stays 40px default per prototype).

- [ ] **Step 1: `sign-in-form.tsx` — email + password inputs and submit**

Add `inputSize="auth"` to both `<Input>` (email ~lines 80-86, password ~lines 101-106). Add `size="auth"` to the submit `<Button>` (~line 109), keeping its existing `className="mt-1 w-full"`. Example for the email input:

```tsx
<Input
  id="email"
  type="email"
  inputSize="auth"
  autoComplete="username"
  {...register("email")}
/>
```

And the button:

```tsx
<Button type="submit" size="auth" disabled={isSubmitting} className="mt-1 w-full">
```

- [ ] **Step 2: `forgot-password-form.tsx` — email input + submit (request step)**

Add `inputSize="auth"` to the email `<Input>` (~lines 87-93) and `size="auth"` to the "Send reset link" `<Button>` (~line 96, keep `w-full`). (The success-state CTA is added in Task 4.)

- [ ] **Step 3: `set-new-password-form.tsx` — both password inputs + submit**

Add `inputSize="auth"` to the `newPassword` `<Input>` (~lines 93-98) and the confirm `<Input>` (~lines 104-109). Add `size="auth"` to the "Update password"/"Activate account" submit `<Button>` (~line 112, keep `w-full`).

- [ ] **Step 4: `change-password-form.tsx` — three inputs + submit**

Add `inputSize="auth"` to the `currentPassword`, `newPassword`, and confirm `<Input>` (~lines 79-105). Add `size="auth"` to the submit `<Button>` (~line 108, keep `w-full`).

- [ ] **Step 5: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Visual check**

`verdict goto http://localhost:3000/login` then `verdict css @<email-input> height` — expect `42px`; check the submit button height is `44px`. Repeat on `/forgot-password`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/_components/sign-in-form.tsx" "src/app/(auth)/_components/forgot-password-form.tsx" "src/app/(auth)/_components/set-new-password-form.tsx" "src/app/(auth)/_components/change-password-form.tsx"
git commit -m "fix(auth): apply auth input (42px) and button (44px) sizes to auth forms"
```

---

## Task 4: Forgot-password "Resend link" success CTA (AU-05)

**Resolves:** AU-05 (per Decisions Adopted — honest "Resend link", not the demo "Open reset link →").

**Files:**
- Modify: `src/app/(auth)/_components/forgot-password-form.tsx`

**Interfaces:**
- Consumes: the form's existing submit handler / mutation that requests the reset email (the same one the request step calls) — re-invoke it with the entered email.

- [ ] **Step 1: Add a full-width primary "Resend link" CTA to the success branch**

In `forgot-password-form.tsx`, the success branch (`if (sent) { … }`, ~lines 43-74) currently renders the checkmark/heading/body and only a "Back to sign-in" link. Insert a primary `Button size="auth"` between the body `<p>` and the "Back to sign-in" `<Link>` that re-requests the email. Use the form's existing request function (the same one wired to the request-step submit — reuse it; do not invent a new mutation). Example (adapt the handler name to the actual one in the file):

```tsx
<Button
  type="button"
  size="auth"
  className="w-full"
  disabled={isSubmitting}
  onClick={() => onSubmit({ email: getValues("email") })}
>
  Resend link
</Button>
```

Keep the existing "Back to sign-in" `<Link>` directly below it. If the request function is not directly callable with `{ email }` (e.g. it's `handleSubmit`-wrapped), call the underlying mutation/action the wrapped handler calls, passing the stored email from `getValues("email")`.

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Visual check**

Submit `/forgot-password` with any email → success screen shows a full-width primary "Resend link" button above "Back to sign-in". Click it → the request fires again (a second notice/toast or no error).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/_components/forgot-password-form.tsx"
git commit -m "fix(auth): add 'Resend link' primary CTA on forgot-password success (honest AU-05)"
```

---

## Task 5: Set/reset password show-hide toggle (AU-06)

**Resolves:** AU-06.

**Files:**
- Modify: `src/app/(auth)/_components/set-new-password-form.tsx`

**Interfaces:**
- Produces: one local `showPassword` state that drives BOTH password fields' `type` (prototype: a single "Show"/"Hide" link next to the NEW PASSWORD label toggles both inputs — `.dc.html:154-159`, `fg.pwType`).

- [ ] **Step 1: Add local show/hide state + a toggle link next to the "New password" label**

In `set-new-password-form.tsx`, add near the top of the component:

```tsx
const [showPassword, setShowPassword] = useState(false);
```

(Add `useState` to the existing `react` import if not present.)

Replace the "New password" `<Label>` row so the label and a show/hide button share a row (prototype `justify-between`, link styled like the existing "Forgot password?" link — `text-small text-[var(--brandink)]`):

```tsx
<div className="flex items-baseline justify-between">
  <Label htmlFor="newPassword">New password</Label>
  <button
    type="button"
    onClick={() => setShowPassword((s) => !s)}
    className="text-small text-[var(--brandink)] underline-offset-4 hover:underline"
  >
    {showPassword ? "Hide" : "Show"}
  </button>
</div>
```

- [ ] **Step 2: Drive both inputs' `type` from the one state**

Change the `newPassword` `<Input>` and the confirm `<Input>` from `type="password"` to:

```tsx
type={showPassword ? "text" : "password"}
```

on BOTH inputs (one toggle governs both, matching the prototype).

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Visual check**

`verdict goto http://localhost:3000/reset-password?token=test` (and `/set-password?token=test`) → a "Show"/"Hide" link sits right of the "New password" label; clicking it reveals BOTH password fields; clicking again hides them.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/_components/set-new-password-form.tsx"
git commit -m "fix(auth): show/hide toggle for new+confirm password fields"
```

---

## Task 6: Set-password title copy + strength-meter spacing (AU-07, AU-08)

**Resolves:** AU-07, AU-08.

**Files:**
- Modify: `src/app/(auth)/set-password/page.tsx` (AU-07)
- Modify: `src/components/ui/password-strength-meter.tsx` (AU-08)

**Note:** `reset-password/page.tsx` already uses "Set a new password" — do NOT change it.

- [ ] **Step 1: Fix the set-password title copy (AU-07)**

In `src/app/(auth)/set-password/page.tsx` (~line 16), change the `title` prop from `"Set your password"` to `"Set a new password"` (matches prototype `.dc.html:152`, the only "set new password" screen the prototype models).

- [ ] **Step 2: Fix strength-meter spacing (AU-08)**

Prototype (`.dc.html:156-157`): bar row `gap:5px`, `margin-top:9px` above the bars; label `margin-top:5px`. In `src/components/ui/password-strength-meter.tsx`, change the root wrapper and bar row:
- Root `<div>`: `className="flex flex-col gap-1.5"` → `className="mt-[3px] flex flex-col gap-[5px]"`. (The consuming field wrapper contributes a 6px gap between the `<Input>` and the meter; `mt-[3px]` brings the input→bars gap to 9px. `gap-[5px]` sets the bars→label gap to 5px.)
- Bar row `<div>`: `className="flex gap-1"` → `className="flex gap-[5px]"` (bar-segment gap 4px → 5px).

Leave the segment/label markup otherwise unchanged. (Both consumers — `set-new-password-form.tsx`, `change-password-form.tsx` — wrap the field in `flex flex-col gap-1.5`, so the `mt-[3px]` math holds.)

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Visual check**

`verdict goto http://localhost:3000/set-password?token=test` → title reads "Set a new password"; typing in the password field shows 4 bars with slightly wider (5px) gaps and a touch more space (9px) below the input.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/set-password/page.tsx" src/components/ui/password-strength-meter.tsx
git commit -m "fix(auth): set-password title copy; strength-meter 5px/9px spacing"
```

---

## Task 7: Hub rail sub-line `typeLabel · updated` + Fullscreen tip card (HB-05, HB-06)

**Resolves:** HB-05, HB-06.

**Files:**
- Modify: `src/features/solutions-hub/components/solutions-hub.tsx`

**Interfaces:**
- Consumes: `typeLabel(type)` exported from `src/features/solutions-hub/components/solution-row.tsx` (already reusable).

- [ ] **Step 1: Combine type + updated in the recent-rail sub-line (HB-05)**

The prototype sub-line is `typeLabel · updated` (`.dc.html:316`). The current `RecentRailRow` sub-line (`solutions-hub.tsx` ~lines 371-373) renders the timestamp only (ticket 23 swapped type-only → timestamp-only; neither matches). Import `typeLabel` and render both joined by ` · `:

```tsx
import { typeLabel } from "./solution-row";
```

Then the sub-line `<div>`:

```tsx
<div style={{ font: "500 var(--m-xs) var(--font-mono)", color: "var(--ink3)" }}>
  {typeLabel(solution.type)}
  {solution.lastOpenedAt ? ` · ${relativeTime(solution.lastOpenedAt)}` : ""}
</div>
```

(Uses the existing `relativeTime` already in scope. If `solution.lastOpenedAt` is null, render just the type label with no trailing ` · `.)

- [ ] **Step 2: Add the Fullscreen tip card to the rail (HB-06)**

Prototype (`.dc.html:320-322`): a plain bordered card, sibling to the "RECENTLY OPENED" box inside the rail `<aside>` (which already has `gap:16`). Add as the aside's second child:

```tsx
<div style={{ border: "1px solid var(--line)", padding: "13px 14px" }}>
  <div className="text-small leading-[1.55] text-[var(--ink2)]">
    Use <b className="text-foreground">Fullscreen</b> on any solution to hide all
    Genie chrome and view it edge-to-edge.
  </div>
</div>
```

(`text-small` = `--t-sm`; "Fullscreen" is bold + `--ink` per prototype.)

- [ ] **Step 3: Render the rail (tip card + recents header) even with zero recents**

The prototype shows the rail content unconditionally within hub access; the current `RecentRail` early-returns `null` when `recents.length === 0`, which would hide the new tip card for users with no recents. Adjust so the `<aside>` (and the Fullscreen tip card) always render when the rail renders; gate only the individual recent-row list on `recents.length > 0` (render the "RECENTLY OPENED" box + its rows only when there are recents, but keep the tip card outside that gate). Do not remove the rail for the responsive/narrow case if that gating exists separately — only remove the empty-recents early return.

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Visual check**

`verdict goto http://localhost:3000` at ≥1180px → the side rail's recent items read `CHAT · 2h ago` (type + updated), and a bordered "Use **Fullscreen** …" tip card sits below the recents. Confirm the tip card still appears for an account with no recents.

- [ ] **Step 6: Commit**

```bash
git add src/features/solutions-hub/components/solutions-hub.tsx
git commit -m "feat(hub): rail sub-line 'type · updated' + Fullscreen tip card"
```

---

## Task 8: Per-solution accent in the viewer chat (VW-01 — avatar/user-bubble/send)

**Resolves:** VW-01 (completes the Wave A header-only deferral).

**Files:**
- Modify: `src/components/ai-elements/message.tsx`, `src/components/ai-elements/prompt-input.tsx`, `src/features/chat/components/chat-conversation.tsx`, `src/features/solution-viewer/components/chat-slot.tsx`

**Interfaces:**
- Produces: optional `accentColor?: string | null` / `accentColorInvert?: string | null` props on `MessageContent`, `MessageAvatar`, `PromptInputSubmit`, and `ChatConversation`. These stay **generic** (plain string props — do NOT import solution/viewer types into the ai-elements primitives). Fallback when null/undefined: `var(--brand)` background / `var(--onbrand)` foreground (identical to the header's existing `chat-slot.tsx:58` fallback).
- Consumes: `chat-slot.tsx` already receives `accentColor`/`accentColorInvert` props (Wave A) and uses them for the header; it must now also pass them into `<ChatConversation>`.

**Note:** the header avatar (34×34, `rgba(255,255,255,.18)`, `.dc.html:498`) is NOT part of this — only the message-row avatar (26×26), the user bubble, and the send button (`.dc.html:506/514/522`, all `demo.brand`).

- [ ] **Step 1: `message.tsx` — optional accent on `MessageContent` (user bubble) and `MessageAvatar`**

`MessageContent` (~line 38) currently applies `from === "user" ? "max-w-[78%] bg-primary text-primary-foreground" : "bg-[var(--panel)] text-foreground"`. Add optional props and apply an inline `style` for the user branch so the accent overrides the brand default (inline style beats the Tailwind class; keep `bg-primary` as the null fallback). Add to the component's prop type:

```tsx
accentColor?: string | null;
accentColorInvert?: string | null;
```

For the user branch, when `accentColor` is set, apply `style={{ background: accentColor, color: accentColorInvert ?? "var(--onbrand)" }}`; otherwise leave the `bg-primary text-primary-foreground` classes (fallback). Keep `max-w-[78%]` and the 3px radius unchanged.

`MessageAvatar` (~line 47) currently uses `bg-primary … text-primary-foreground`. It already spreads `...props` onto its `<div>`, so accept the same two optional props and, when `accentColor` is set, pass `style={{ background: accentColor, color: accentColorInvert ?? "var(--onbrand)" }}`. Keep 26×26, weight 800, `text-[10px]`.

- [ ] **Step 2: `prompt-input.tsx` — optional accent on `PromptInputSubmit`**

`PromptInputSubmit` (~lines 60-68) renders a `<Button variant="primary">`. Add optional `accentColor?: string | null` / `accentColorInvert?: string | null` props; when `accentColor` is set, pass `style={{ background: accentColor, color: accentColorInvert ?? "var(--onbrand)" }}` to the `<Button>` (inline style overrides the `primary` variant's `bg-primary`). When null, leave `variant="primary"` as-is (brand fallback).

- [ ] **Step 3: `chat-conversation.tsx` — thread the props through**

Add `accentColor?: string | null` and `accentColorInvert?: string | null` to `ChatConversationProps` (~lines 27-33). Pass them to: both `MessageAvatar` call sites (~lines 118, 145), the `MessageContent` for the user role (~line 122), and `PromptInputSubmit` (~line 198).

- [ ] **Step 4: `chat-slot.tsx` — pass accent into `ChatConversation`**

At the `<ChatConversation … />` call (~lines 98-104), add `accentColor={accentColor}` and `accentColorInvert={accentColorInvert}` (both already in scope from the component's Wave A props).

- [ ] **Step 5: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Visual check**

`verdict goto http://localhost:3000/s/<seeded-accent-slug>` → the message-row bot avatar, the user message bubble, and the send button all use the solution's accent color. Open an unseeded solution → all three fall back to brand blue. `verdict css @<send-button> background-color` on a seeded solution ≠ `#2360c4`; on an unseeded one = `rgb(35, 96, 196)`.

- [ ] **Step 7: Commit**

```bash
git add src/components/ai-elements/message.tsx src/components/ai-elements/prompt-input.tsx src/features/chat/components/chat-conversation.tsx src/features/solution-viewer/components/chat-slot.tsx
git commit -m "feat(viewer): per-solution accent on chat avatar, user bubble, send button"
```

---

## Task 9: Bot-bubble chat panel shade (VW-03)

**Resolves:** VW-03.

**Files:**
- Modify: `src/app/globals.css`, `src/components/ai-elements/message.tsx`

**Interfaces:**
- Produces: `--panel-chat` token. Do NOT change the shared `--panel` (it also drives `--secondary`/`--muted`/`--accent`/sidebar).

- [ ] **Step 1: Add the `--panel-chat` token**

In `src/app/globals.css`, in the light `:root` color block (near `--panel: #f2f4f7;`, ~line 25) add:

```css
  --panel-chat: #f1f3f6; /* bot chat bubble — slightly darker than --panel (prototype .dc.html:507) */
```

In the `[data-theme="dark"]` block (near the dark `--panel: #1d242e;`, ~line 55) add:

```css
  --panel-chat: #1d242e; /* dark: match --panel (no prototype dark ground truth; keeps dark unchanged) */
```

(The dark value intentionally equals the current dark `--panel` so dark mode does not regress; only light mode shifts `#f2f4f7` → `#f1f3f6`.)

- [ ] **Step 2: Point the assistant bubble at `--panel-chat`**

In `src/components/ai-elements/message.tsx` (~line 39), the assistant/bot branch uses `bg-[var(--panel)]`. Change to `bg-[var(--panel-chat)]`. Leave the user branch (Task 8) unchanged.

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Visual check**

`verdict goto http://localhost:3000/s/<slug>` → bot bubbles read `#f1f3f6` in light mode. `verdict css @<bot-bubble> background-color` → `rgb(241, 243, 246)`. Toggle dark mode → bubble unchanged from before.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ai-elements/message.tsx
git commit -m "fix(viewer): bot-bubble --panel-chat shade #f1f3f6 (light)"
```

---

## Task 10: Theme toggle 30×30 (WS-03)

**Resolves:** WS-03. (WS-02 is a documented non-defect — no change; see Decisions Adopted.)

**Files:**
- Modify: `src/components/theme-toggle.tsx`

- [ ] **Step 1: Shrink the toggle to 30×30 with the prototype glyph styling**

Prototype (`.dc.html:247`): `width:30px;height:30px`, 1px border, `font-size:var(--t-body)`, default (sans) font glyph. The current `<Button variant="ghost" size="icon" …>` is 40×40 (`size-10`) with an inline `fontSize: var(--m-lg)` mono glyph. Keep `variant="ghost"` (it supplies the 1px border), but override the size and glyph font. Replace the `size="icon"` + inline style with a fixed 30px box and `--t-body` sans glyph:

```tsx
<Button
  variant="ghost"
  aria-label="Toggle theme"
  onClick={() => setTheme(isDark ? "light" : "dark")}
  className="size-[30px] p-0 text-body"
>
  {mounted ? (isDark ? "☼" : "☾") : "·"}
</Button>
```

(Drop `size="icon"` so the `size-[30px]` className governs; `p-0` prevents ghost padding from inflating it; `text-body` = `--t-body`; remove the `fontFamily: var(--font-mono)` so the glyph uses the default sans face per prototype. If `variant="ghost"` requires a `size`, pass `size="icon"` AND override with `size-[30px] p-0` in className — the Wave A `cn()` fix makes the className win.)

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Visual check**

`verdict goto http://localhost:3000` → the header theme toggle is 30×30 (matches the adjacent 30px header controls). `verdict css @<theme-toggle> height` → `30px`.

- [ ] **Step 4: Commit**

```bash
git add src/components/theme-toggle.tsx
git commit -m "fix(shell): theme toggle 30x30 with --t-body sans glyph"
```

---

## Task 11: `StatusBadge` outline variant + "This device" badge (AC-03)

**Resolves:** AC-03.

**Files:**
- Modify: `src/components/ui/status-badge.tsx`, `src/app/(workspace)/account/_components/sessions-panel.tsx`

**Interfaces:**
- Produces: `StatusBadge` gains `variant?: "solid" | "outline"` (default `"solid"` — existing filled-tint look, unchanged). `"outline"` = tone-colored 1px border, transparent background, tone-colored text, `px-[5px] py-[2px]` (prototype `.dc.html:379`). Font-size/uppercase already correct (`--m-xs`, from Wave A commit `35033a5`).

- [ ] **Step 1: Add the `outline` variant to `badgeVariants`**

In `src/components/ui/status-badge.tsx`, the `cva` currently has a single `tone` variant group with filled tints. Add a `variant` group and adjust padding for outline. Keep the base class's `px-[7px] py-[3px]` for solid; outline uses `px-[5px] py-[2px]`. Add compound variants so each tone's outline uses that tone's color for border+text on a transparent background. Concretely, extend the config:

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-none font-mono text-mono-xs font-semibold uppercase tracking-[0.06em]",
  {
    variants: {
      tone: {
        neutral: "",
        success: "",
        warn: "",
        error: "",
      },
      variant: {
        solid: "px-[7px] py-[3px]",
        outline: "border bg-transparent px-[5px] py-[2px]",
      },
    },
    compoundVariants: [
      // solid = filled tint (existing look)
      { tone: "success", variant: "solid", class: "bg-[var(--successtint)] text-[var(--success)]" },
      { tone: "warn", variant: "solid", class: "bg-[var(--warntint)] text-[var(--warn)]" },
      { tone: "error", variant: "solid", class: "bg-[var(--errortint)] text-[var(--error)]" },
      { tone: "neutral", variant: "solid", class: "bg-[var(--panel)] text-[var(--ink2)]" },
      // outline = hairline border in tone color, transparent fill
      { tone: "success", variant: "outline", class: "border-[var(--success)] text-[var(--success)]" },
      { tone: "warn", variant: "outline", class: "border-[var(--warn)] text-[var(--warn)]" },
      { tone: "error", variant: "outline", class: "border-[var(--error)] text-[var(--error)]" },
      { tone: "neutral", variant: "outline", class: "border-[var(--line)] text-[var(--ink2)]" },
    ],
    defaultVariants: {
      tone: "neutral",
      variant: "solid",
    },
  },
);
```

**Important:** match the tone keys and tint token names to the EXISTING `status-badge.tsx` (read it first — use its actual tone set and `--*tint` token names; the block above is the shape, not necessarily the exact token list). Move each existing tone's filled classes into the `solid` compound variants so the default look is byte-identical to today. Update the `StatusBadge` function signature to accept `variant` via `VariantProps<typeof badgeVariants>` and pass it through `badgeVariants({ tone, variant })`.

- [ ] **Step 2: Use the outline variant for "This device"**

In `sessions-panel.tsx` (~line 164), change `<StatusBadge tone="success">This device</StatusBadge>` to `<StatusBadge tone="success" variant="outline">This device</StatusBadge>`.

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. TypeScript confirms all existing `StatusBadge` call sites still compile (they omit `variant` → default `solid`).

- [ ] **Step 4: Visual check**

`verdict goto http://localhost:3000/account` (Devices tab) → the current session shows a "THIS DEVICE" badge with a hairline success border and no fill. Confirm other `StatusBadge` usages (e.g. admin tables, solution status) still render filled (default `solid`) — spot-check one.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/status-badge.tsx "src/app/(workspace)/account/_components/sessions-panel.tsx"
git commit -m "feat(ui): StatusBadge outline variant; 'This device' uses hairline outline"
```

---

## Task 12: Session sub-line `browser · IP · when` (AC-02)

**Resolves:** AC-02 (per Decisions Adopted — `browser · IP · when`; no geolocation available).

**Files:**
- Modify: `src/app/(workspace)/account/_components/sessions-panel.tsx`

- [ ] **Step 1: Recompose the session sub-line**

The device-name line already shows `deviceLabel(s.userAgent)` (e.g. "Chrome on macOS"). The sub-line (~lines 165-168) currently reads `{ipAddress} · Last active {relativeTime(updatedAt)}`. Recompose to `browser · IP · when`, deriving the browser from the userAgent. If `deviceLabel()` returns a combined "Chrome on macOS", extract or add a small `browserName(userAgent)` helper (Chrome/Safari/Firefox/Edge) in the same file, or reuse the browser portion. Render:

```tsx
<span className="text-mono-sm text-[var(--ink3)]">
  {[browserName(s.userAgent), s.ipAddress, `Last active ${relativeTime(s.updatedAt)}`]
    .filter(Boolean)
    .join(" · ")}
</span>
```

Skip segments that are empty (`.filter(Boolean)`), so a session with no IP still reads cleanly. Keep the device-name line above unchanged.

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Visual check**

`verdict goto http://localhost:3000/account` (Devices tab) → each session sub-line reads like `Chrome · 203.0.113.4 · Last active 2h ago`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(workspace)/account/_components/sessions-panel.tsx"
git commit -m "fix(account): session sub-line 'browser · IP · when'"
```

---

## Task 13: "Trusted devices & timeout" card — honest hybrid (AC-01)

**Resolves:** AC-01 (per Decisions Adopted — real session-timeout preview; remembered-devices informational, no fake action).

**Files:**
- Modify: `src/app/(workspace)/account/_components/sessions-panel.tsx`
- Read (for wiring): `src/components/idle-timeout.tsx` (the real idle-timeout mechanism)

**Interfaces:**
- Consumes: whatever preview/trigger hook `idle-timeout.tsx` exposes for the timeout row. If it exposes no callable preview API, the "Preview" affordance may surface the configured idle minutes without a fake trigger — do NOT invent a mutation.

- [ ] **Step 1: Inspect the idle-timeout mechanism**

Read `src/components/idle-timeout.tsx` (rendered in `workspace-chrome.tsx`). Determine (a) the configured idle-timeout minutes value (the prototype copy says "15 minutes"), and (b) whether it exposes any callable "show the warning now" API. Record what's available — this decides how honest the "Preview" affordance can be.

- [ ] **Step 2: Build the card (prototype `.dc.html:385-395`)**

Below the existing sessions list in `sessions-panel.tsx`, add the card. Prototype: `border:1px solid var(--line);background:var(--surface);padding:20px 22px;margin-top:16px`; Archivo-800 `--t-title` title; two rows separated by a `--line2` border; each row = label (`--t-body`) + sub-copy (`--t-xs`, `--ink3`) on the left, a ghost 32px button on the right. **Honest-hybrid adaptations:**
- Row 1 "Remembered devices" — informational only. Render the label + a truthful sub-copy, and either omit the "Forget all" button or render it disabled with an explanatory affordance. Do NOT render an enabled "Forget all" that no-ops. Suggested sub-copy: "Device trust isn't enabled yet — sessions expire on sign-out." (Adjust wording to match reality; keep it customer-safe.)
- Row 2 "Session timeout" — real. Sub-copy uses the actual configured minutes from Step 1: "You're signed out automatically after {N} minutes idle." The "Preview" button uses the real idle-timeout API if one exists (Step 1); if none exists, omit the button (title + real copy is still a truthful improvement over the current omission).

Example skeleton (fill copy/handlers from Steps 1-2):

```tsx
<div
  className="mt-4 border border-[var(--line)] bg-[var(--surface)]"
  style={{ padding: "20px 22px" }}
>
  <div className="font-heading text-title font-extrabold text-[var(--ink)]">
    Trusted devices &amp; timeout
  </div>
  <div className="mt-[14px] flex items-center justify-between gap-3 border-b border-[var(--line2)] pb-[14px]">
    <div className="min-w-0">
      <div className="text-body text-[var(--ink)]">Remembered devices</div>
      <div className="mt-0.5 text-mono-xs text-[var(--ink3)]">
        Device trust isn&apos;t enabled yet — sessions expire on sign-out.
      </div>
    </div>
    {/* no fake action: omit or disable the button per Step 2 */}
  </div>
  <div className="mt-[14px] flex items-center justify-between gap-3">
    <div className="min-w-0">
      <div className="text-body text-[var(--ink)]">Session timeout</div>
      <div className="mt-0.5 text-mono-xs text-[var(--ink3)]">
        You&apos;re signed out automatically after {IDLE_MINUTES} minutes idle.
      </div>
    </div>
    {/* real "Preview" Button (ghost, h-8) only if idle-timeout exposes a trigger */}
  </div>
</div>
```

Use `text-mono-xs` for the `--t-xs` sub-copy size, `text-body` for `--t-body`, `text-title` + `font-heading font-extrabold` for the Archivo title. If a "Preview"/"Forget all" button is rendered, use `<Button variant="ghost" size="sm">` (h-8=32px) — no fake handler.

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Visual check**

`verdict goto http://localhost:3000/account` (Devices tab) → a "Trusted devices & timeout" card appears below the sessions list with the two rows. The session-timeout minutes shown match the real idle-timeout config. No enabled button performs a fake action.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(workspace)/account/_components/sessions-panel.tsx"
git commit -m "feat(account): trusted devices & timeout card (honest hybrid — real timeout, informational device row)"
```

---

## Task 14: Account sub-nav padding (AC-04)

**Resolves:** AC-04.

**Files:**
- Modify: `src/app/(workspace)/account/page.tsx`

- [ ] **Step 1: Fix the sub-nav item padding + remove the hover fill**

The account sub-nav button (`account/page.tsx`, ~lines 73-78 post-`4fc21fc`) uses `px-[10px] py-2` (10/8px) with `hover:bg-[var(--panel)]` on the inactive branch. Prototype (`.dc.html:1819`): `padding:9px 12px`, and the inline style has NO hover-fill. Change:
- `px-[10px] py-2` → `px-3 py-[9px]` (12px horizontal, 9px vertical).
- Remove `hover:bg-[var(--panel)]` from the inactive branch (leave the rest of the inactive classes — `border-transparent text-[var(--ink2)]`).

Leave the active-branch classes (`border-[var(--brand)] bg-[var(--brandtint)] font-bold text-[var(--brandink)]`) unchanged.

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Visual check**

`verdict goto http://localhost:3000/account` → sub-nav items (Profile / Password / Devices & sessions) have `9px 12px` padding and no grey hover fill on inactive items.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(workspace)/account/page.tsx"
git commit -m "fix(account): sub-nav padding 9px 12px; drop non-prototype hover fill"
```

---

## Task 15: Wave B verification + docs

**Resolves:** cross-wave continuity.

**Files:**
- Modify: `docs/execution-log/index.md` (append a Wave B entry).

- [ ] **Step 1: Full typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS, clean (allow only the pre-existing `scripts/` `no-await-in-loop` warnings).

- [ ] **Step 2: Full visual sweep against the prototype**

Run `pnpm dev`. Walk every Wave B surface with `verdict` and compare to `docs/design-package/Genie Control Station.dc.html`:
- Auth (`/login`, `/forgot-password`, `/reset-password?token=…`, `/set-password?token=…`, `/change-password`) — 42px inputs, 44px buttons, ✓/! banners, no SOC2 footer, resend CTA, show/hide, title copy, strength spacing.
- Hub (`/`) — rail sub-line `type · updated`, Fullscreen tip card.
- Viewer (`/s/<seeded-slug>`) — accent avatar/bubble/send; bot bubble `#f1f3f6`.
- Shell — theme toggle 30×30.
- Account (`/account`) — "This device" outline badge, `browser · IP · when` sub-line, trusted-devices card, sub-nav padding.

Note any residual drift for Wave C — do NOT fix out-of-scope items here.

- [ ] **Step 3: Append the Wave B execution-log entry**

Add a `## Wave B · Surfaces …` section to `docs/execution-log/index.md` (mirror the Wave A entry's format): what shipped, the four adopted decisions (AU-05 resend, WS-02 non-defect, AC-01 honest hybrid, AC-02 browser·IP·when) as accepted deviations, and the verified-already-done items (HB-07, VW-02).

- [ ] **Step 4: Commit**

```bash
git add docs/execution-log/index.md
git commit -m "docs(log): Wave B surfaces complete — auth, hub rail, viewer accent, account"
```

- [ ] **Step 5: Report**

Summarize Wave B completion: resolved findings (AU-01…AU-08, HB-05/06, VW-01/03, WS-03, AC-01…AC-04), the four adopted decisions, verified-already-done (HB-07, VW-02, WS-02 non-defect), and hand off to Wave C (the entire admin console).

---

## Out of scope for Wave B (Wave C)

The entire admin console: People (AP-00…AP-11, incl. P0 temp-password flow + grid rebuild), Groups/Access (AG-01…AG-07, incl. P0 grid rebuild), Solutions (ASol-00…ASol-10, incl. P0 configure modal + grid), Themes (AT-00…AT-08, incl. P0 dark CSS editor mock), and the admin shell nav (AS-01). Plus WS-05 (drag-reorder persistence). These become the Wave C plan.
