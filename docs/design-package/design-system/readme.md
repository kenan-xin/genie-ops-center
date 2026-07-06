# Genie · "Ledger" Design System

The interface language for **Genie Workspace** — where teams open AI agents and admins manage access. It is built as one consistent system intended to host production apps over time, so keep it neutral and product-agnostic: **do not** tie copy to any single app, and **do not** use the names "Genie Control Station", "agents hub", or "demo-management console".

The aesthetic is **"Ledger"**: firm, utilitarian, precise. Think a well-set financial ledger or SOC-2 console — hairline rules, square corners, monospace labels, and color used only to mean something.

---

## Sources
- Living visual spec: `../Genie Style Guide.dc.html` (open it — it renders every foundation + component).
- Reference implementation: the Genie Workspace prototype DC in this project (auth, workspace, viewer, admin console). Lift exact values from there.
- Fonts: Geist (display + UI/body), Geist Mono (data/labels) — both Google Fonts.

## Index / manifest
- **[`implementation.md`](./implementation.md)** — the **living implementation reference**: tokens as shipped in `src/app/globals.css` + the React component kit (`src/components/ui/`) with real variants/props. Read this when working in code.
- `styles.css` — entry point; `@import`s the four token files. Link this one file.
- `tokens/colors.css` — ink scale, surfaces, lines, brand, semantic (light + `[data-theme="dark"]`).
- `tokens/typography.css` — three font families + size scale + the mono-eyebrow note.
- `tokens/spacing.css` — spacing scale, radius (square-ish), elevation, motion, focus ring.
- `tokens/fonts.css` — Google Fonts import.
- `SKILL.md` — how a future agent should use this.

> This `readme.md` is the **visual spec**. Where it and `implementation.md` disagree, the code
> wins — disagreements are logged in [`implementation.md` § Drift log](./implementation.md#drift-log).

---

## CONTENT FUNDAMENTALS
- **Voice:** plain, calm, operator-grade. Short declarative sentences. Explain consequences ("They lose access immediately and are removed from all groups.").
- **Person:** address the user as **you**; refer to people by name ("Tom Riley re-enrols at next sign-in").
- **Casing:** Sentence case for headings, body, and buttons ("Add person", "Update password"). **UPPERCASE** only for mono labels — eyebrows, field labels, status, table headers, counts.
- **Buttons:** verb-first, concise — "Add person", "Send reset link", "Revoke all", "Verify & continue". Destructive verbs are explicit — "Delete group", "Remove person".
- **Status words:** Ready, Draft, Maintenance, Down, Pending, Active, Disabled. Prefix live/critical statuses with a `●` dot ("● READY", "● UNDER MAINTENANCE").
- **Eyebrows:** a mono uppercase kicker labels a moment ("RESET LINK SENT", "TWO-FACTOR", "HOW ACCESS WORKS").
- **No emoji.** No exclamatory marketing tone. No "Oops!". Errors are factual ("Incorrect code — 4 attempts left.").
- **Numbers/IDs/time** are mono ("MX-44192", "2h ago", "5 OF 8 SHOWN", "482913").

## VISUAL FOUNDATIONS
- **Color:** light-first, near-white surfaces on a cool grey bg. Brand blue `#2360c4` ONLY for the primary action and current selection (nav item, selected row). All other color is semantic: success green, warning amber, error red — each with a pale tint used as a badge/callout background. No gradients. No decorative color.
- **Type:** Geist for display/headings (wt 800, letter-spacing ≈ -0.02em) AND all UI + prose (wt 400–700) — one family, both roles by weight; Geist Mono for labels/data (wt 600, letter-spacing ≈ 0.06–0.14em, uppercase). Every text size is a responsive token (see "Responsive" below), never a hard-coded px — mono labels included.
- **Shape:** square-ish. Radius 0 for cards/inputs/badges/buttons; up to 3px for chat bubbles. **Pills (border-radius:11px) are reserved exclusively for toggle switches.** Mono-icon tiles (e.g. "PT", "CD") are 30px squares with no radius.
- **Structure:** 1px hairlines (`--line`, `--line2`) define everything; a 2px ink rule underlines major result blocks. Tables = header row on `--panel` + hairline-separated rows; row hover = `--panel` fill.
- **Elevation:** flat by default. Shadow only on lifted surfaces — toasts, dialogs, right-edge slide-overs, dropdown menus.
- **Backgrounds:** solid only. No images, textures, meshes, or grain.
- **Borders/cards:** card = `1px solid var(--line)` on `--surface`, no radius, no shadow. Avoid the "rounded card + colored left-border" cliché — accents are full hairline borders or tint fills, not a single colored edge.
- **Motion:** short and mechanical (.15–.22s, ease `cubic-bezier(.4,0,.2,1)`). Drawer/slide-over translate; toasts fade-up 6px; spinners rotate; skeletons shimmer opacity. No bounce, no scale-pop.
- **Hover:** ghost buttons & rows → `--panel` fill; text links/nav → color deepens toward `--ink`. **Press/active:** no shrink — color shift only. **Focus:** `outline:2px solid var(--brand); outline-offset:-1px` on inputs/selects/textareas.
- **Layout:** mobile-first. Sidebar is a fixed off-canvas drawer under 920px (hamburger), static 212px column above. Two content-width tiers — `--content-wide` (grid / dual-pane: hub, access, overview, admin) and `--content-list` (single-column: recent, favorites, account) — both scale per breakpoint so nothing is stranded narrow. Tables scroll horizontally inside a bordered, `overflow:auto` container with a `min-width`.
- **Transparency/blur:** only modal scrims — `rgba(8,10,14,.45–.55)`, no blur.

## RESPONSIVE
- **Approach:** Tailwind-style **stepped** scaling (sizes jump at each breakpoint and hold between), not fluid `clamp()`. Type tokens AND container/sidebar widths are redefined at every tier, so they always move together — never big headings beside a stranded narrow column, never frozen tiny labels.
- **Breakpoints (8 tiers):** base mobile · 480 (large mobile) · 768 (tablet) · 1024 (laptop) · 1280 (desktop) · 1440 (large desktop) · 1920 (2K) · 2560 (4K). Defined in `tokens/typography.css` (type) and `tokens/spacing.css` (containers).
- **Type tokens:** 12 role names (`--t-display`…`--t-xs`, `--m-xs`…`--m-lg`) alias to 8 `--fs-*` sizes, which derive from **just 3 base knobs** via fixed ratios — `--base-h` (headings: display ×1, cardhead ×0.78, h3 ×0.60), `--base-b` (body ×1, sm ×0.88), `--base-l` (labels ×1 / ×1.13 / ×1.27). Each breakpoint sets **only those 3 numbers**. Actual range: body 15→19px, display 25→40px, mono labels 11→14px. Reshape a role across all tiers by editing its ratio; resize a whole group by editing its `--base-*`. **Never hard-code a px font size** — and never use the page-title token `--t-display` inside a fixed-width card/dialog; use `--t-cardhead` there.
- **Container tokens** (`--auth-w`, `--content-wide/list`, `--sidebar-w`): auth card 400→600, content-wide 1180→1880 (grid/dual-pane screens), content-list 1000→1500 (single-column lists & settings), sidebar 212→320. (`--content-mid` exists as an optional narrow reading column.)
- **Layout reflow** (direct rules, not tokens): under **920px** the sidebar collapses to an off-canvas drawer (hamburger) and tables stack into rows; at **1180px+** the hub gains its second-column side-rail. Tables otherwise scroll horizontally inside a bordered `overflow:auto` container with a `min-width`.

## ICONOGRAPHY
- Icons are **minimal and typographic**, not an icon library. Use crisp Unicode marks and tiny inline SVGs already in the prototype: `✓` (success/check), `!` (alert), `★ / ☆` (favorite), `›` (chevron), `✕` (close), `←  → ↑ ↗ ↻` (nav/refresh), `☰` (mobile menu), `⏻` (sign out), `∅` (empty), `●` (status dot). The send arrow is a small inline SVG (paper-plane).
- Status moments do **not** use icon badges. They lead with a **mono eyebrow** (e.g. `● UNDER MAINTENANCE`) optionally over a 30×3px semantic accent bar, or a small **squared keyline tile** (38px, 1.5px semantic border + tint) containing a single typographic mark (`✓` / `!`). **Never** a filled circle with an emoji/glyph.
- No emoji anywhere. No third-party icon font. If a real icon set is ever needed, add a thin-stroke line set (e.g. Lucide) and document it here — but default to the typographic marks above.
- Custom carets: native `<select>` carets vary, so for balanced padding wrap a select in `position:relative` with `appearance:none` + a CSS-triangle caret (`border-left/right transparent + border-top` in `--ink3`). Do NOT use SVG `data:` URI backgrounds on form controls — they break html-to-image export.

## COMPONENTS (recipes)
The style guide DC renders all of these; copy values from it or from the prototype.
- **Control heights (shared scale):** all form controls derive height from one source of truth — `src/components/ui/control-size.ts` (`CONTROL_HEIGHTS`: `sm`=32 / `md`=40 / `lg`=44px; `CONTROL_MIN_HEIGHTS` for controls that may wrap; `ControlSize` type). `Button`, `Input`, `Select`, `SegmentedControl`, and `SearchInput` all read from it — **never hard-code `h-8/h-10/h-11` on a control.** Any horizontal row that mixes control types (search / input / select / segmented / button) renders all members at the same height; the standard is **40px (`md`)**. `SegmentedControl` uses **min-height** so long labels grow instead of clipping. Deliberate compact exceptions: the `transfer-list` pane search (32px) and the inline table status-pill `Select` (`h-auto`) override the default via `className` and must stay compact; `Input`'s `auth` size (42px, auth screens only) is separate.
- **Buttons:** Primary (`--brand` fill, white, wt700, 40px), Dark (`--ink` fill), Ghost (transparent + `--line` border, wt600), Destructive (ghost with `--error` text), Text link (`--brand`, wt600).
- **Inputs:** 40–42px, `1px solid var(--line)`, radius 0, 12px padding; label above is a mono uppercase eyebrow.
- **Select:** as inputs + the wrapped CSS-triangle caret (see Iconography).
- **Status badge:** `font:600 8.5px mono; letter-spacing .06em;` semantic color on its tint, 4×8px padding, no radius; `●` prefix for live states.
- **Toggle:** 38×22 pill track (`--brand` on / `--line` off) + 18px white knob; the only pill in the system.
- **Segmented control:** bordered row, active segment = `--ink` fill / white; dividers are `border-left:1px solid var(--line)`.
- **Tabs:** text + `border-bottom:2px solid var(--brand)` on active.
- **Card:** `1px solid var(--line)` on `--surface`, no radius/shadow.
- **Table row:** grid; mono "XX" tile + name/desc; status badge; row-level controls (e.g. favorite ★) live in their OWN trailing column, never crowded against data.
- **Dialog / confirm:** centered card, `--shadow-dialog`, scrim; header (Geist title + body), footer with right-aligned Cancel (ghost) + primary; destructive primary uses `--error`.
- **Slide-over:** right-edge panel, `--shadow-side`, used for record editing (e.g. a person).
- **Toast:** surface card + 4px semantic left bar + mono ✓/! mark; auto-dismiss; fade-up.
- **Empty state:** dashed 1.5px square (42px) with `∅` (or `☆`), Geist title, muted body, optional ghost CTA.
- **Loading:** skeleton rows (shimmer opacity on `--line2` bars) for tables; rotating ring spinner for embedded/processing.
- **Status hero:** confirmation = squared keyline ✓ tile + mono eyebrow; disruption = 30×3px semantic bar + mono eyebrow + Geist headline.
- **Chat:** bot bubble = `--panel`, user bubble = `--brand`/white, radius 3px; 26px avatar tile; optional ▲▼ feedback under bot replies.
- **Offline/connectivity:** fixed top `--error` bar, driven by real `online`/`offline` events.
