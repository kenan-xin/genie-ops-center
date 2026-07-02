# Design Drift Remediation — Design Spec

**Date:** 2026-07-02
**Status:** Draft (pending user review)
**Source of truth:** `Genie Control Station.dc.html` (the rendered prototype), cross-referenced with `Genie Style Guide.dc.html` and `design-system/tokens/*.css`.
**Scope:** Eliminate visual/UX drift between the prototype and the running app across every surface — auth, workspace shell, solutions hub, solution viewer, account, and the full admin console.

---

## 1. Context & the font decision

A full page-by-page, component-by-component audit of the prototype (`Genie Control Station.dc.html`, 1934 lines) against the implementation surfaced one systemic contradiction and four root causes.

**Font system — decided:** the rendered prototype loads **Archivo** (headings/initials/avatars, wt 800), **Hanken Grotesk** (UI/body/inputs, wt 400–700), and **IBM Plex Mono** (eyebrows/labels/counts, wt 400–600). The design-system tokens, the Style Guide, and the current implementation all use **Geist / Geist Mono**. The rendered prototype is the typography source of truth. The app switches to Archivo + Hanken Grotesk + IBM Plex Mono.

## 2. Root causes

Four causes explain the majority of findings. Resolving them unblocks large groups of individual fixes:

1. **Font mismatch** *(P1)* — every heading, input, and mono label renders in Geist. Remapping the three family tokens + swapping `next/font` loads resolves dozens of "feels off" issues.
2. **Tables built as semantic `<table>` instead of CSS grids** — the prototype's directories use `display:grid` with explicit `fr` column ratios; the impl uses real `<table>`s with auto-sized columns, so proportions can never match.
3. **Toolbar controls standardized to 40px** — prototype toolbars (search/select/+Add) are 32–34px with a leading circle search glyph and **ink-filled** "+ Add" buttons. The impl uses the kit's 40px inputs/buttons (brand-blue "Add").
4. **Chips/tags rendered as uppercase mono `StatusBadge` pills** — prototype group tags and people-reached chips are mixed-case **sans** chips with a 1px line border + 2px radius.

## 3. Findings inventory

Severity: **P0** = missing feature / wrong surface / structurally broken. **P1** = visible layout/style/interaction mismatch. **P2** = polish.

### 3.1 Cross-cutting (foundations & tokens)

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| XF-01 | P1 | Font families | Archivo (display), Hanken Grotesk (UI/body), IBM Plex Mono (labels) | Geist + Geist Mono (`globals.css:78-80`, `layout.tsx:8-16`) |
| XF-02 | P1 | New `Chip` primitive needed | mixed-case sans, 1px `--line` border, 2px radius, padding 2/7–4/10, ellipsis | (none — `StatusBadge` is misused as chips everywhere) |
| XF-03 | P2 | `--chrome` dark-mode value | `#0f1319` (`tokens/colors.css:54`) | `#e7ecf3` (`globals.css:61`) |
| XF-04 | P2 | Status badge font-size | `11.5px` / `--m-xs` | `text-mono-sm` ≈ 12px (`status-badge.tsx:8`) |
| XF-05 | P2 | Status badge padding + dot gap | `3px 7px`, `●` inline with text | `px-2 py-1` (8/4), `gap-1` separates dot |
| XF-06 | P2 | Table header font-size | `--m-xs` ≈ 11px | `text-mono-sm` ≈ 12px (`table.tsx:52`) |
| XF-07 | P2 | Card/dialog title tracking | `-0.02em` (auth) / `-0.01em` (cardhead) | `-0.01em` uniformly |
| XF-08 | P2 | Skeleton shimmer cadence | custom 1.1s `.45↔.9` (`@keyframes csShimmer`) | Tailwind `animate-pulse` (`skeleton.tsx:9`) |
| XF-09 | P2 | Button hover treatment | `filter:brightness(.94)` | `hover:opacity-90` (`button.tsx:14-15`) |
| XF-10 | P2 | Slide-over scrim weight | `0.45` (matches dialog) | `0.32` (`slide-over.tsx:16`) |

### 3.2 Auth

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| AU-01 | P1 | Auth input height + font-size | `height:42px`, `font-size:var(--t-title)` | `h-10` (40px), `text-body` (`input.tsx:10`) |
| AU-02 | P1 | Auth submit button height + size | `height:44px`, `--t-title`, full width | `h-10` (40px), `text-small` (`button.tsx:23`) |
| AU-03 | P1 | Notice/error banner glyphs | `✓` / `!` (Archivo 800) prefix, padding 9/11 & 8/10 | no glyph, `px-3 py-2` (`form-feedback.tsx`) |
| AU-04 | P1 | "SOC 2 TYPE II" footer | (none) | added below every auth card (`(auth)/layout.tsx:51-60`) — remove |
| AU-05 | P1 | Forgot-password success CTA | primary "Open reset link →" + "Back to sign-in" | only "Back to sign-in" (`forgot-password-form.tsx:43-74`) |
| AU-06 | P1 | Set/reset password show-hide | show/hide link next to NEW PASSWORD | missing (`set-new-password-form.tsx:91-111`) |
| AU-07 | P2 | Set-password title copy | "Set a new password" | "Set your password" (`set-password/page.tsx:17-18`) |
| AU-08 | P2 | Strength meter spacing | `margin-top:9px`, bar `gap:5px` | form `gap-1.5` |

### 3.3 Workspace shell & favorites

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| WS-01 | — | Favorites→sidebar pinning | sidebar PINNED rail (≤6), draggable, brand active | **fully implemented & wired** (`pinned-favorites.tsx`, `chrome-store.ts`, `hub.ts:36-51`) — no defect |
| WS-02 | P1 | Sidebar footer role label | "WORKSPACE OWNER" | "WORKSPACE MEMBER"/"ADMIN" (`user-footer.tsx:19-23`) |
| WS-03 | P1 | Theme toggle size | 30×30 | `size-10` (40×40) (`theme-toggle.tsx:19-21`) |
| WS-04 | P1 | Sidebar wordmark/eyebrow font | Archivo / IBM Plex Mono | Geist / Geist Mono (folds into XF-01) |
| WS-05 | P2 | Drag-reorder persistence | local demo state in prototype too | local state only — parity, but persist in a follow-up |

### 3.4 Solutions hub

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| HB-01 | P1 | Hub table breakpoint | `920px` | `960px` (`globals.css:478`) |
| HB-02 | P1 | `.cs-hubpad` padding ladder | stepped: base → `34px 40px` → `40px 52px` → `48px 64px` → `60px 80px` | **class referenced but never defined** → stuck at 24px (`globals.css`) |
| HB-03 | P1 | Mono "XX" tile color | per-solution `iconBg`/`iconFg` | flat `--panel`/`--ink` (`solution-row.tsx:46-58`) |
| HB-04 | P1 | Side-rail recent tile color | per-solution `iconBg`/`iconFg` | flat `--panel` (`solutions-hub.tsx:343-360`) |
| HB-05 | P2 | Side-rail recent sub-line | `typeLabel · updated` | type only, timestamp dropped (`solutions-hub.tsx:374-376`) |
| HB-06 | P2 | Side-rail "Fullscreen" tip card | bordered card under recents | missing entirely (`solutions-hub.tsx:306-326`) |
| HB-07 | P1 | Recent/favorites row padding | `padding:16px` | missing — rows flush to edges (`solution-list-row.tsx:131-150`) |

### 3.5 Solution viewer

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| VW-01 | P1 | Per-solution theming | header/avatar/bubbles/send use `demo.brand` | fixed `var(--brand)` (`chat-slot.tsx:58`, `message.tsx`, `prompt-input.tsx`) |
| VW-02 | P1 | Down-status notice CTA | ghost "← Back" + brand "View status page ↗" | only "← Back" (`status-notice.tsx:104-125`) |
| VW-03 | P2 | Bot-bubble `--panel` shade | `#f1f3f6` (darker) | `#f2f4f7` (single grey) |
| VW-04 | P2 | Extra controls (by-design) | — | in-content toolbar, "New chat", "Smart-API" label — acceptable additions |

### 3.6 Account

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| AC-01 | P1 | "Trusted devices & timeout" card | second card on Devices tab | **omitted** ("no backing data") (`sessions-panel.tsx:26-28`) |
| AC-02 | P2 | Sessions sub-line | browser · location · when | IP + "Last active N" (`sessions-panel.tsx:161-170`) |
| AC-03 | P2 | "This device" badge | `--m-xs`, hairline success border, uppercase | one size up, no border, sentence case |
| AC-04 | P2 | Account sub-nav padding | `9px 12px`, no hover fill | `px-[10px] py-2`, `hover:bg-panel` added (`account/page.tsx:74`) |

### 3.7 Admin shell

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| AS-01 | P1 | Admin nav "Overview" item | top-level (People, Groups, Access, Solutions, Overview, Theme Builder) | folded into Access; "Themes" renamed (`admin-nav-items.ts:15-33`) |
| AS-02 | — | Admin IA (sidebar vs tabs) | prototype is tabbed single-panel | persistent sidebar — **deliberate build decision**, not a defect |

### 3.8 Admin → People

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| AP-00 | **P0** | Temp-password flow | 2-step account-action dialog: method chooser ("Email reset link" + green RECOMMENDED + "Set temp password" + "Require change" toggle) → result screen | minimal one-shot dialog, no chooser/success (`temp-password-dialog.tsx`) |
| AP-01 | **P0** | People table column proportions | grid `1.7fr .8fr 1.7fr .8fr .8fr .6fr` | real `<table>`, auto columns (`people-directory.tsx:155-235`) |
| AP-02 | P1 | Search input | 32px, circle glyph, `max-w 220px` | 40px, no glyph (`people-directory.tsx:99-104`) |
| AP-03 | P1 | "+ Add person" button | ink-filled, 32px | brand-blue, 40px (`people-directory.tsx:111`) |
| AP-04 | P1 | GROUPS chips | mixed-case sans, bordered, 2px radius, ellipsis | uppercase mono `StatusBadge` (`people-directory.tsx:198-209`) |
| AP-05 | P1 | User email font | `--m-md` mono | `text-mono-xs` (one step small) (`people-directory.tsx:174-184`) |
| AP-06 | P1 | Edit-person slide-over close + width | `✕` in header, 440px | no `✕`, 420px (`edit-person-slide-over.tsx`, `slide-over.tsx:21`) |
| AP-07 | P1 | Account-actions button set | "Reset password" (→ chooser) + "Force sign-out" | 3 buttons (split reset) (`edit-person-slide-over.tsx:331-363`) |
| AP-08 | P2 | Account-active toggle on-color | ink-on | brand-on (`edit-person-slide-over.tsx:372-385`) |
| AP-09 | P2 | Pending-card buttons | 30px, "Resend" white fill | `h-8`, ghost (`edit-person-slide-over.tsx:270-285`) |
| AP-10 | P2 | "Remove" button border | `1px solid --error` | neutral line border (`edit-person-slide-over.tsx:388-403`) |
| AP-11 | P2 | Info banner body/border color | body `#2a4d80`, border `#d7e3f6` | `--brandink`/`--brand/25` (`people-directory.tsx:85-92`) |

### 3.9 Admin → Groups / Access

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| AG-01 | **P0** | Groups table column proportions | grid `2.6fr .9fr 40px` | real `<table>`, auto columns (`groups-directory.tsx:116-141`) |
| AG-02 | P1 | Search + "New group" button | 32px search w/ glyph, ink-filled button | 40px, no glyph, brand button (`groups-directory.tsx:82-90`) |
| AG-03 | P2 | Group description font | sans `--t-xs` | mono (`groups-directory.tsx:131`) |
| AG-04 | P1 | Transfer-list pane gap + height | `gap:24px`, list `clamp(380px,52vh,640px)` | `gap:12px`, `max-h-64` (256px) (`grants-panel.tsx`, `transfer-list.tsx`) |
| AG-05 | P1 | Transfer-list header quick-links | "Add all shown →" / "Revoke all" | missing (`transfer-list.tsx`) |
| AG-06 | P2 | People-reached chips | mixed-case sans bordered | mono `StatusBadge` (`access-overview.tsx:164-170`) |
| AG-07 | P2 | By-solution card right-side badge | type label | status badge (`access-overview.tsx:113-128`) |

### 3.10 Admin → Solutions

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| ASol-00 | **P0** | Configure surface | centered 460px modal, `CONFIGURE · {type}` eyebrow + `✕` | right-edge slide-over (`edit-solution-slide-over.tsx`) |
| ASol-01 | **P0** | Solutions table column proportions | grid `1.5fr .5fr .9fr 1.6fr`, `min-width 880px` | real `<table>`, `min-w 720px` (`solutions-directory.tsx:177-185`) |
| ASol-02 | P1 | Type filter missing "Native" | All / Chat / Native / Embedded | All / Chat / Embedded (`solutions-directory.tsx:51-55`) |
| ASol-03 | P1 | Register dialog missing "Native" type | Chat / Native / Embedded | Chat / Embedded (`register-solution-dialog.tsx:116-123`) |
| ASol-04 | P1 | Register DESCRIPTION field | single-line input 38px | 2-row textarea (`register-solution-dialog.tsx:128-134`) |
| ASol-05 | P1 | Solution avatar | 30px, no border, Archivo 800 | 32px, border, mono (`solutions-directory.tsx:289-294`) |
| ASol-06 | P1 | STATUS cell | single inline badge-select | badge + separate dropdown (`solutions-directory.tsx:323-335`) |
| ASol-07 | P1 | Embedded config fields | App URL + Frame Height + Allow fullscreen + Open in new tab | only iframe URL (`edit-solution-slide-over.tsx:362-388`) |
| ASol-08 | P1 | Register dialog header close | `✕` | missing (`register-solution-dialog.tsx:98-100`) |
| ASol-09 | P2 | TYPE label font | `--m-md` wt 600 | `text-mono-sm` (`solutions-directory.tsx:315-316`) |
| ASol-10 | P2 | Solutions subtitle | (none) | added descriptive subtitle (`solutions-directory.tsx:98-103`) |

### 3.11 Admin → Themes

| ID | Sev | Finding | Prototype | Implementation |
|----|-----|---------|-----------|----------------|
| AT-00 | **P0** | CSS tab dark editor mock | `#0f1319` bg, syntax CSS, blinking cursor, "presentational" note | plain light textarea (`theme-builder.tsx:357-372`) |
| AT-01 | P1 | Theme switching UX | in-place state swap | route-based navigation (full reload) (`themes/[id]/page.tsx`, `theme-builder.tsx:57-63`) |
| AT-02 | P1 | Selected theme pill | brand border + brandtint + ink text, 12px swatch | inverted ink, 10px swatch (`theme-builder.tsx:134-162`) |
| AT-03 | P1 | Color swatches | 26px round, ink ring selected, line ring unselected, 2px white gap | 32px, brand ring, no unselected ring (`theme-builder.tsx:402-417`) |
| AT-04 | P1 | Radius presets | Sharp=4 / Soft=12 / Round=20 | Sharp=0 / Soft=10 / Round=20 (`theme.ts`) |
| AT-05 | P1 | Font options | Hanken Grotesk / Archivo / Mono / Serif | generic System/ Serif/ Mono/ Rounded (`theme.ts`) |
| AT-06 | P1 | Live preview chrome | 32px avatar "A", "Sample Assistant" + "Preview · {theme}", bubbles 82% | iframe, no avatar/labels, bubbles 78%, fixed 560px (`theme-preview.tsx`) |
| AT-07 | P2 | Tab control padding/width | `8px 10px`, `--t-xs`, equal-width | `px-4 py-2`, `text-small`, not equal (`theme-builder.tsx:244-249`) |
| AT-08 | P2 | Preset cards layout | flex-wrap min-118px | fixed 2-col grid (`theme-builder.tsx:253-275`) |

## 4. Remediation plan (3 waves)

Each wave is independently shippable. Waves are ordered so that foundation work unblocks the largest number of surface fixes.

### Wave A — Foundations & tokens
- **A1. Font remap (XF-01):** add Archivo, Hanken Grotesk, IBM Plex Mono via `next/font/google`; remap `--font-display`/`--font-ui`/`--font-mono` in `globals.css`. (Resolves WS-04, AU font drift, admin chrome font drift, AT-05 source values.)
- **A2. Hub CSS (HB-01, HB-02):** define the `.cs-hubpad` ladder and change the hub table breakpoint from 960px to 920px in `globals.css`.
- **A3. Per-solution theming hook (HB-03, HB-04, VW-01):** thread `brand`/`iconBg`/`iconFg`/`typeLabel` from solution records into hub tiles, rail tiles, and the viewer chat surface.
- **A4. New `Chip` primitive (XF-02):** mixed-case sans, 1px line border, 2px radius, ellipsis — replaces `StatusBadge` misuse (AP-04, AG-06) and the by-solution badge (AG-07).
- **A5. Token/kit corrections (XF-03…XF-10):** status-badge size/padding (XF-04/05), table-header size (XF-06), card-title tracking (XF-07), skeleton shimmer keyframe (XF-08), button hover (XF-09), slide-over scrim (XF-10), `--chrome` dark value (XF-03).

### Wave B — Surfaces (auth, hub, viewer, account)
- **B1. Auth (AU-01…AU-08):** add a `size="auth"` variant to `Button` (`h-11`=44px, `--t-title`) and an `inputSize="auth"` prop to `Input` (`h-[42px]`, `--t-title`) — these are auth-surface-only sizes, not a global change to the kit's 40px default. Then: banner `✓`/`!` glyphs, remove SOC2 footer, forgot-success CTA, password show-hide, copy fixes.
- **B2. Hub rows & rail (HB-05, HB-06, HB-07):** row 16px padding, rail `· updated`, Fullscreen tip card.
- **B3. Viewer (VW-01, VW-02, VW-03):** per-solution theming (depends on A3), status-page link, bot-bubble shade.
- **B4. Workspace shell (WS-02, WS-03):** role label, theme-toggle size.
- **B5. Account (AC-01…AC-04):** trusted-devices card, sessions meta line, "This device" badge, sub-nav padding.

### Wave C — Admin console (heaviest)
- **C1. Directory grids (AP-01, AG-01, ASol-01):** rebuild People/Solutions/Groups directories as grid rows with explicit `fr` column templates (port the prototype's `.cs-trow` pattern or a colgroup-driven grid).
- **C2. Admin toolbars (AP-02, AP-03, AG-02):** 32px search (circle glyph) + ink-filled "+ Add"/"+ New group" buttons.
- **C3. P0 flows:**
  - Temp-password 2-step dialog (AP-00).
  - Configure centered modal (ASol-00) + embedded fields (ASol-07).
  - Themes dark CSS editor mock (AT-00).
- **C4. Slide-over/dialog close + width (AP-06, ASol-08):** add `✕`, widen to 440px.
- **C5. Transfer lists (AG-04, AG-05):** gap 24px, clamp height, header quick-links.
- **C6. Solutions/Themes specifics (ASol-02…ASol-10, AT-01…AT-08):** Native type, register fields/avatar/status cell, themes in-place switching, swatches, radius/font presets, preview chrome.
- **C7. People specifics (AP-05, AP-07, AP-08, AP-09, AP-10, AP-11):** email font, actions set, toggle color, pending/remove buttons, info banner.

## 5. Out of scope / explicit non-defects
- **Admin sidebar IA (AS-02):** persistent sidebar vs prototype's tabs is a deliberate build decision.
- **Viewer extras (VW-04):** in-content toolbar, "New chat", "Smart-API" label are acceptable additions.
- **WS-01 favorites pinning:** fully implemented; no defect.
- **WS-05 drag-reorder persistence:** parity with prototype; defer to a separate follow-up.

## 6. Verification
- Per-wave visual verification against the rendered prototype using `verdict` (per global rules) at the 920/1180/1440 breakpoints.
- `pnpm typecheck` + `pnpm lint` after each wave.
- Each P0 finding gets an explicit before/after screenshot in its implementation ticket.
