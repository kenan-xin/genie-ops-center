# Ledger — Design System

> A single-file, copy-anywhere design system. It defines an interface language — the
> **aesthetic, tokens, responsive scales, and component recipes** — with no ties to any
> one product. Hand it to a design or build tool and ask it to construct any application;
> the result will look and behave consistently. Paste it whole; it needs no other files.

**Ledger** is a firm, utilitarian, precise interface language — think a well-set financial
ledger or a SOC-2 console. Hairline rules, square corners, monospace labels, and colour
used only to mean something. It is deliberately calm, dense, and operator-grade: built for
tools people work in, not marketing surfaces.

Keep any product built on it **content-neutral** — the system carries the visual voice; the
product supplies the nouns.

---

## 1. The ten rules that define the look

1. **Square corners.** Radius `0` on cards/inputs/badges/buttons; `3px` max on speech-style
   bubbles. The **11px pill is reserved exclusively for the toggle switch** — nowhere else.
2. **Hairlines do the work, not shadows.** Everything is defined by 1px keylines
   (`--line` / `--line2`); a 2px ink rule underlines major result blocks. Shadow appears
   *only* on lifted surfaces (toast, dialog, slide-over, dropdown).
3. **Accent colour is reserved.** The brand blue `#2360c4` is used **only** for the primary
   action and the current selection (active nav item, selected row, focus ring). Every other
   hue is semantic.
4. **Colour always means something.** success / warn / error only — each paired with a pale
   tint used as a badge/callout background. No decorative colour. No gradients.
5. **Two roles, by weight + a mono voice.** One sans for display *and* body (weight does the
   work); one mono for labels/data. Never hard-code a px font size — every size is a
   responsive token (see §4).
6. **The mono eyebrow is the signature.** A mono, uppercase, tracked kicker (`● UNDER
   MAINTENANCE`) labels a moment and **replaces decorative status icons**. It sits above a
   sans headline.
7. **Sentence case everywhere except mono labels.** Headings, body, and buttons are sentence
   case ("Add person"). UPPERCASE is only for mono labels — eyebrows, field labels, table
   headers, status, counts.
8. **Flat, solid backgrounds.** No images, textures, meshes, grain, or blur (the only
   translucency is a modal scrim `rgba(8,10,14,.45–.55)`, no blur).
9. **Motion is short and mechanical.** `.15–.22s`, `cubic-bezier(.4,0,.2,1)`. No bounce, no
   scale-pop. Press = colour shift only (no shrink).
10. **No emoji, no icon font.** Icons are typographic Unicode marks + tiny inline SVGs (see
    §9). Status moments never use a filled circle with a glyph.

**Absolute bans:** gradients · decorative colour · rounded "card + coloured left-border"
cliché · pills anywhere but the toggle · emoji · a filled-circle status glyph · hard-coded
px font sizes · using the page-title size inside a fixed-width card/dialog.

---

## 2. Typefaces

Three families, two roles. Load them however your stack loads fonts (all three are Google
Fonts) and bind them to the family tokens.

| Role token | Family | Weights | Used for |
| --- | --- | --- | --- |
| `--font-display` | **Archivo** | 500/600/700/800 | Display/headlines, card & dialog titles. wt 700–800, tracking ≈ −0.02em. |
| `--font-ui` | **Hanken Grotesk** | 400/500/600/700 | All UI, prose, and body. wt 400–700. The default `sans`. |
| `--font-mono` | **IBM Plex Mono** | 400/500/600 | Eyebrows, status, IDs, timestamps, counts, table headers. wt 600, uppercase, tracked .06–.14em. |

```css
:root {
  --font-display: "Archivo", system-ui, sans-serif;
  --font-ui:      "Hanken Grotesk", system-ui, sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, monospace;
}
```

One sans (Archivo) covers *both* display and — via lighter weights — could stand in for UI,
but the system pairs it with **Hanken Grotesk** for body/UI so headlines read tighter and
denser than running text. Weight, not a third family, distinguishes hierarchy.

---

## 3. Colour tokens

Two directions in light mode: **cool near-white surfaces** and **one reserved accent blue**.
Everything else is semantic. Dark mode uses the **same token names** (flip
`data-theme="dark"` on a container) — never reach for a different variable in dark.

```css
:root {
  /* Ink scale — text, strongest → faintest */
  --ink:    #14161b;  /* primary text, dark fills, 2px rules, logo mark */
  --ink2:   #4a515c;  /* secondary text */
  --ink3:   #8b929c;  /* tertiary / muted labels, placeholders, caret triangles */
  --faint:  #aab0ba;  /* disabled text, faint marks */
  --on-ink: #ffffff;  /* text/icons on --ink or --brand fills */

  /* Surfaces & structure */
  --bg:         #fbfcfd;  /* app content background (cool near-white) */
  --surface:    #ffffff;  /* cards, panels, inputs, chrome */
  --panel:      #f2f4f7;  /* recessed/header fills, mono-icon tiles, hover fill */
  --panel-alt:  #f1f3f6;  /* a shade darker than --panel — e.g. inset bubbles/wells */
  --line:       #c8cdd5;  /* standard hairline keyline */
  --line2:      #e2e5ea;  /* lighter hairline — inner dividers, skeleton bars */
  --rule:       #14161b;  /* heavy 2px section underline */

  /* Chrome — app shell */
  --sidebar: #ffffff;  /* sidebar fill (matches --surface) */
  --chrome:  #14161b;  /* logo mark / chrome accent */

  /* Accent — primary action + current selection ONLY */
  --brand:     #2360c4;
  --brandink:  #2360c4;  /* accent text (lightens in dark) */
  --brandtint: #eef4fc;  /* accent wash behind selection / callouts */
  --onbrand:   #ffffff;

  /* Semantic — each pairs a foreground with a tint background */
  --success: #1f9a5c;  --successtint: #eafaf1;  /* Ready · Active · On */
  --warn:    #b07d10;  --warntint:    #fbf3df;  /* Maintenance · Pending */
  --error:   #d94032;  --errortint:   #fbeae8;  /* Down · Failed · Delete */
}

[data-theme="dark"] {
  --ink:    #eef1f4;  --ink2: #9aa3b0;  --ink3: #6b7585;  --faint: #5c6675;  --on-ink: #0f1319;
  --bg:      #13171e;  --surface: #181d25;  --panel: #1d242e;  --panel-alt: #1d242e;
  --line:    #313a46;  --line2:   #262e38;  --rule:  #3a4454;
  --sidebar: #13171e;  --chrome:  #0f1319;
  --brand:   #2360c4;  --brandink: #7fb2f0;  --brandtint: #1c2738;  --onbrand: #ffffff;
  --success: #5fcf94;  --successtint: #16271d;
  --warn:    #d6a743;  --warntint:    #2a2310;
  --error:   #e06a5e;  --errortint:   #2a1714;
}
```

**Colour rules that aren't tokens:**
- Status colour **never travels alone** — always foreground + tint (e.g. a badge is
  `--success` text on `--successtint`).
- Accent blue is only for primary action + current selection + focus ring.
- No decorative colour, no gradients, no coloured left-border accent stripe.

---

## 4. Responsive typography — the core system

Type is **stepped, not fluid**. Sizes *jump* at each breakpoint and hold between — the
Tailwind-style approach, not a `clamp()` curve. Type tokens **and** container/sidebar widths
(§6) are redefined at every tier, so headings and layout always move together: never a big
heading beside a stranded-narrow column, never a frozen-tiny label while its neighbours grow.

### 4.1 The three-knob architecture

The whole scale collapses to **three numbers per breakpoint**:

```
--base-h   headings knob
--base-b   body knob
--base-l   labels knob
```

From those three knobs, **8 raw sizes** are derived by *fixed ratios* (defined once, never
per-breakpoint):

```css
--fs-xl:    var(--base-h);                 /* display */
--fs-card:  calc(var(--base-h) * 0.78);    /* card/dialog title */
--fs-lg:    calc(var(--base-h) * 0.60);    /* sub-head */
--fs-md:    var(--base-b);                 /* body */
--fs-sm:    calc(var(--base-b) * 0.88);    /* small */
--fs-lbl:   var(--base-l);                 /* mono eyebrow */
--fs-lblmd: calc(var(--base-l) * 1.13);    /* mono mid (counts) */
--fs-lbllg: calc(var(--base-l) * 1.27);    /* mono large (chips/data) */
```

Those 8 sizes are then aliased to **12 role-name tokens** you actually use in markup (also
fixed, never redefined per breakpoint). Duplicate aliases (display=h2, h3=title, sm=xs,
m-xs=m-sm) can therefore **never drift**:

```css
--t-display: var(--fs-xl);   --t-h2: var(--fs-xl);      /* page / section display */
--t-cardhead: var(--fs-card);                            /* card/dialog titles */
--t-h3: var(--fs-lg);        --t-title: var(--fs-lg);   /* sub-heads / card titles */
--t-body: var(--fs-md);                                  /* body + inputs */
--t-sm: var(--fs-sm);        --t-xs: var(--fs-sm);      /* small text */
--m-xs: var(--fs-lbl);       --m-sm: var(--fs-lbl);     /* mono eyebrows */
--m-md: var(--fs-lblmd);                                 /* mono mid (counts) */
--m-lg: var(--fs-lbllg);                                 /* mono large (chips/data) */
```

**How to change type:** reshape a role across *all* tiers by editing its **ratio**; resize a
whole group (all headings, all body, all labels) by editing its **`--base-*` knob**. Never
fork a single breakpoint.

### 4.2 The breakpoint ladder (8 tiers, mobile → 4K)

Each media query sets **only the three knobs**:

```css
:root { --base-h: 25px; --base-b: 15px;   --base-l: 11px;   } /* base  (<480) */
@media (min-width:480px)  { :root { --base-h:26px; --base-b:15px;   --base-l:11px;   } }
@media (min-width:768px)  { :root { --base-h:28px; --base-b:15.5px; --base-l:11.5px; } }
@media (min-width:1024px) { :root { --base-h:30px; --base-b:15.5px; --base-l:11.5px; } }
@media (min-width:1280px) { :root { --base-h:31px; --base-b:16px;   --base-l:12px;   } }
@media (min-width:1440px) { :root { --base-h:33px; --base-b:16px;   --base-l:12px;   } }
@media (min-width:1920px) { :root { --base-h:37px; --base-b:17.5px; --base-l:13px;   } }
@media (min-width:2560px) { :root { --base-h:40px; --base-b:19px;   --base-l:14px;   } }
```

| Breakpoint | `--base-h` | `--base-b` | `--base-l` |
| --- | --- | --- | --- |
| base (<480) | 25 | 15 | 11 |
| ≥480 (large mobile) | 26 | 15 | 11 |
| ≥768 (tablet) | 28 | 15.5 | 11.5 |
| ≥1024 (laptop) | 30 | 15.5 | 11.5 |
| ≥1280 (desktop) | 31 | 16 | 12 |
| ≥1440 (large desktop) | 33 | 16 | 12 |
| ≥1920 (2K) | 37 | 17.5 | 13 |
| ≥2560 (4K) | 40 | 19 | 14 |

**Actual ranges:** body 15 → 19px · display 25 → 40px · mono labels 11 → 14px.

### 4.3 Effective desktop scale (≥1280: h=31, b=16, l=12)

| Role token | Size | Family / weight | Use |
| --- | --- | --- | --- |
| `--t-display` / `--t-h2` | **31px** | Archivo 800, tracking −0.02em | Page & section titles |
| `--t-cardhead` | **24px** | Archivo 800 | Titles inside fixed-width cards/dialogs |
| `--t-h3` / `--t-title` | **18.5px** | Archivo/Hanken 700 | Sub-heads & card titles |
| `--t-body` | **16px** | Hanken 400–500 | Default reading size, table cells, inputs |
| `--t-sm` / `--t-xs` | **14px** | Hanken 400 | Secondary & tertiary text |
| `--m-xs` / `--m-sm` | **12px** | IBM Plex Mono 600, tracked | Eyebrows, field labels, status, table headers |
| `--m-md` | **13.5px** | IBM Plex Mono 600 | Counts |
| `--m-lg` | **15px** | IBM Plex Mono 600 | Chips / data |

### 4.4 Optional utility layer

If your stack supports design-token utilities, expose the scale as classes so nothing
hard-codes a px size:

```
text-display   text-cardhead   text-title   text-body   text-small
text-mono-xs   text-mono-sm    text-mono-md text-mono-lg
font-heading (Archivo)   font-sans (Hanken)   font-mono (IBM Plex Mono)
```

### 4.5 Type hard rules

- **Never hard-code a px/rem font size** — reach for a `--t-*` / `--m-*` token or its utility.
- **Never use `--t-display` inside a fixed-width card or dialog** — use `--t-cardhead`.
- The **mono eyebrow** is the signature moment marker:
  ```html
  <div style="font:600 var(--m-sm) var(--font-mono);letter-spacing:.12em;color:var(--brand)">
    ● UNDER MAINTENANCE
  </div>
  ```
  It sits **above** a sans headline and replaces status icons. Prefix live/critical states with `●`.

---

## 5. Spacing, radius, elevation, motion

```css
:root {
  /* Spacing — 4-based */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* Radius — square-ish; 0 default, 3px max content, 11px = toggle ONLY */
  --radius-0: 0px;     /* cards, inputs, badges, buttons */
  --radius-1: 2px;     /* chips, small tiles */
  --radius-2: 3px;     /* speech-style bubbles — the MAX radius for any content */
  --radius-pill: 11px; /* toggle tracks ONLY */

  /* Elevation — shadow only on lifted surfaces */
  --shadow-toast:  0 8px 26px rgba(20,30,50,.16);
  --shadow-dialog: 0 12px 34px rgba(20,30,50,.18);
  --shadow-side:   -16px 0 40px rgba(20,30,50,.18); /* right-edge slide-over */

  /* Motion — short, mechanical, no bounce */
  --ease: cubic-bezier(.4,0,.2,1);
  --dur-fast: .15s;
  --dur-base: .22s;  /* drawer / slide-over */
}
```

- **Flat by default** — hairlines carry structure; shadow only on toast/dialog/slide-over/dropdown.
- **Focus ring (shared form-control rule):** `outline:2px solid var(--brand); outline-offset:-1px`
  on `:where(input, select, textarea):focus-visible`. Don't reinvent per control.
- **Reduced motion is global** — a single `@media (prefers-reduced-motion: reduce)` block
  collapses every animation/transition to `0.01ms`. Individual components need no re-guarding,
  but animation must be non-essential (content stays visible when motion is removed).

---

## 6. Layout & responsive containers

Container and sidebar widths step on the **same breakpoints** as the type scale, so they
always move together. Names below are the reference tokens — rename freely, keep the ladder.

```css
:root {
  --modal-w: 400px;  --modal-pad: 26px 22px 24px;  /* auth / dialog / focused card */
  --content-wide: 1180px;   /* grid / dual-pane work screens */
  --content-mid:  900px;    /* optional narrow reading column */
  --content-list: 1000px;   /* single-column list & settings screens */
  --sidebar-w: 212px;       /* persistent app sidebar (≥920px) */
}
@media (min-width:1024px){ :root{ --modal-w:440px; --modal-pad:38px 38px 34px; --content-wide:1240px; --content-mid:960px;  --content-list:1060px; } }
@media (min-width:1280px){ :root{ --modal-w:460px; --content-wide:1320px; --content-mid:1000px; --content-list:1120px; } }
@media (min-width:1440px){ :root{ --modal-w:480px; --content-wide:1400px; --content-mid:1080px; --content-list:1200px; --sidebar-w:236px; } }
@media (min-width:1920px){ :root{ --modal-w:520px; --modal-pad:48px 48px 44px; --content-wide:1560px; --content-mid:1180px; --content-list:1320px; --sidebar-w:264px; } }
@media (min-width:2560px){ :root{ --modal-w:600px; --modal-pad:56px 56px 52px; --content-wide:1880px; --content-mid:1320px; --content-list:1500px; --sidebar-w:320px; } }
```

| Token | <480 | ≥1024 | ≥1280 | ≥1440 | ≥1920 | ≥2560 |
| --- | --- | --- | --- | --- | --- | --- |
| `--modal-w` | 400 | 440 | 460 | 480 | 520 | 600 |
| `--content-wide` | 1180 | 1240 | 1320 | 1400 | 1560 | 1880 |
| `--content-list` | 1000 | 1060 | 1120 | 1200 | 1320 | 1500 |
| `--content-mid` | 900 | 960 | 1000 | 1080 | 1180 | 1320 |
| `--sidebar-w` | 212 | 212 | 212 | 236 | 264 | 320 |

**Reusable reflow patterns (direct CSS rules, not tokens):**
- **Mobile-first, always.** Design the narrow layout first; widen with `min-width` queries.
- **App-shell sidebar.** Under **920px** the sidebar is an off-canvas drawer (≈250px / max
  84vw) behind a scrim, toggled by a hamburger inside the header; at **≥920px** it becomes a
  static column at `--sidebar-w` and the hamburger disappears.
- **Responsive data table.** Under 920px rows **stack as a single-column list** (secondary
  columns hide); at ≥920px a table-grid with a mono header row appears. Otherwise a table
  scrolls horizontally inside a bordered `overflow:auto` container with a `min-width`, so
  columns never crush.
- **Two-column content.** A primary column carries a **secondary side-rail** that appears only
  at a wide breakpoint (e.g. ≥1180px) and widens with each tier; below that it stacks under
  the primary column.
- **Content gutter ladder.** Page padding scales by tier so wide screens breathe instead of
  hugging edges — e.g. `24px` → `34px 40px` → `40px 52px` → `48px 64px` → `60px 80px`.

---

## 7. Control heights (shared scale — single source of truth)

All form controls derive height from **one place** — a single height scale, so any toolbar
aligns automatically:

```
sm = 32px    md = 40px    lg = 44px
```

- **Never hard-code a control height** — read from the scale.
- **Any horizontal row mixing control types** (search / input / select / segmented / button)
  renders every member at the **same height — the standard is 40px (`md`)**.
- **Segmented controls use min-height**, not a fixed height, so long wrapped labels grow
  instead of clipping.
- **Deliberate compact exceptions** override per-instance and must stay small — don't
  propagate them (e.g. a picklist pane search at 32px, an inline table status-pill select at
  auto height). A focused auth/dialog input may run at 42px with `--t-title` type — a separate,
  screen-scoped exception, not part of the `sm/md/lg` scale.

---

## 8. Component recipes

Each recipe below is framework-agnostic — the values, structure, and states are what matter.
Compose them with whatever primitive/headless library your stack uses.

### Controls

**Button** — square corners, sans, type via the `--t-*` scale, press = colour shift (no shrink).
- Variants: `primary` (accent fill, white, wt700, hover brightness −6%) · `dark` (`--ink`
  fill, wt700) · `ghost` (transparent + `--line` border, wt600, hover `--panel` fill) ·
  `destructive` (ghost shell, `--error` text, hover `--errortint` fill) · `link` (accent,
  wt600, inline — no height/padding).
- Sizes: `default` (40px, 18px horizontal padding) · `sm` (32px, 12px) · `auth` (44px, 18px,
  `--t-title`) · `icon` (40×40).
- Verb-first labels: "Add person", "Delete group".

**Input** — hairline border, square, 12px padding, placeholder `--ink3`, body type. Focused
auth variant runs at 42px with `--t-title`. Focus = the global form-control ring.

**Textarea** — same recipe as Input, multi-line, `min-h-24`, resize-y. Opt into mono per
instance for code/data.

**Select** — trigger matches the input recipe with a **pure-CSS triangle caret** (never an
SVG data-URI background — it breaks html-to-image export). Popup = hairline-bordered lifted
surface; the selected item reads in accent with a `✓`. Fire the blur/close event so
touched-state validation works. Supports `size` (`sm/md/lg`), `placeholder`, `disabled`.

**SearchInput** — bordered composite: hairline border, a CSS circle-outline glyph (not an
icon), a borderless inner input. Default width ≈220px (`max-w-48vw`), overridable.

**SegmentedControl** — bordered row; active segment = **`--ink` fill / white** (accent stays
reserved); dividers = a left hairline. Uses **min-height** so labels wrap. `role="tablist"`.

**Switch** — the **only pill in the system**. 38×22 track (`--brand` on / `--line` off) + 18px
white knob that translates 16px.

### Labels & feedback

**Label** — mono uppercase eyebrow (mono family, `--m-xs`, wt600, `tracking .1em`, `--ink2`).
The Ledger field/section label. Associate via `for`/`id`.

**FieldError** (`--t-sm`, `--error`; renders nothing when empty) · **FormError** (`role="alert"`,
hairline box on `--errortint`, leading `!`) · **NoticeBanner** (`role="status"`, hairline box
on `--successtint`, leading `✓`). Keep copy neutral and factual.

**PasswordStrengthMeter** — 4 segments coloured weak/fair/good (`--error`/`--warn`/`--success`)
+ a mono label, `aria-live="polite"`. **Visualises only** — enforce the actual strength gate
in your validation layer, not here.

### Surfaces & containers

**Card** — `1px solid var(--line)` on `--surface`, no radius, no shadow. Sub-parts: `Header`
(padded, flex-col) · `Title` (`--t-cardhead`, wt800, tracking −0.02em) · `Description` (`--t-sm`,
`--ink2`) · `Content` · `Footer` (right-aligned, top border on `--line2`). **Nested cards are
always wrong** — cards contain surfaces, they don't wrap every section.

**StatusBadge** — mono uppercase on a semantic tint, square, `tracking .06em`, `--m-xs` wt600.
`tone`: `success|warn|error|neutral|brand`. `variant`: `solid` (filled tint, ~7×3px padding) ·
`outline` (hairline tone-coloured border, transparent fill, ~5×2px — a distinct family, e.g.
"THIS DEVICE"). A `dot` option prefixes `●` for live/critical states.

**Chip** — **mixed-case SANS** (not mono), 1px hairline border, 2px radius, `--surface` fill,
`--t-sm` wt500. `tone`: `neutral` · `brand` (accent border + `--brandtint` fill). Truncates for
long values. **Distinct from StatusBadge — do not swap them.**

**EmptyState** — dashed 1.5px 42px square keyline tile + a glyph (default `∅`), `--t-title`
heading, muted body (`max-w 42ch`), optional CTA.

### Overlays & status

**Dialog / SlideOver** — centered card (Dialog) / right-edge panel (SlideOver), each with a
`rgba(8,10,14,.45)` scrim (no blur), square corners, fade + slight rise (`.2s`). SlideOver
translates in from the right with `--shadow-side`. Both share `Content` + `Header` + `Title` +
`Footer` (footers right-aligned with a `--line2` top border); Dialog adds `Description`,
SlideOver adds `Body`.

**Confirm** — a single shared danger-confirm dialog, resolved as a promise. `tone: "danger"`
renders a filled `--error` confirm button; default renders accent. Reuse it for every
destructive action rather than hand-rolling confirmations.

**Toast** — auto-dismiss ~4s. `tone`: `success|error|info`. Surface card + 4px semantic left
bar + a semantic mark (`✓`/`!`/`●`, sans extrabold), fades up 6px.

**Tooltip** — hairline, square, **`--ink`-dark fill** (dark-on-light inversion), fade + a
subtle `scale-95` enter/exit (`.15s`).

### Data & loading

**Table** — always wrap a table in a bordered horizontal-scroll container and give the table a
`min-width`. Header cells are mono uppercase on `--panel` (`tracking .07em`, `--ink2`). Rows are
hairline-separated (`--line2`); hover = `--panel` fill. Row-level controls (e.g. a favorite ★)
live in their **own trailing column**, never crowded against data.

**Skeleton** — shimmer bar on `--line2` (opacity `.45↔.9` over ~1.1s). **Spinner** — rotating
ring (`role="status"`), `--line2` track + `--brand` arc.

**Tabs** — filled segmented strip attached to the panel below (same recipe as SegmentedControl:
active = `--ink` fill / white); dividers are a hairline.

**TransferList** — dual-pane picklist (move items between "available" and "selected"). Each
item may carry a mono tile glyph (falls back to initials). The pane search is the compact 32px
exception.

**Chat bubble** (if the product has conversation UI) — incoming bubble = `--panel-alt`,
outgoing = `--brand`/white, radius `3px`; ~26px avatar tile; optional ▲▼ feedback under
replies. Sanitise any externally-supplied inline styling down to a closed set of semantic
tones — never re-allow arbitrary `style`.

---

## 9. Iconography

Icons are **minimal and typographic**, not an icon library.

- **Unicode marks:** `✓` (check) · `!` (alert) · `★ / ☆` (favorite) · `›` (chevron) · `✕`
  (close) · `← → ↑ ↗ ↻` (nav/refresh) · `☰` (mobile menu) · `⏻` (sign out) · `∅` (empty) ·
  `●` (status dot). A send arrow is a small inline SVG paper-plane.
- **Status moments do NOT use icon badges.** They lead with a **mono eyebrow** (e.g. `● UNDER
  MAINTENANCE`), optionally over a 30×3px semantic accent bar, or a small **squared keyline
  tile** (38px, 1.5px semantic border + tint) containing one typographic mark (`✓`/`!`).
  **Never** a filled circle with an emoji/glyph.
- **Custom `<select>` carets:** wrap in `position:relative` + `appearance:none` + a CSS-triangle
  caret (`border-left/right transparent + border-top` in `--ink3`). **Never** use SVG `data:`
  URI backgrounds on form controls — they break html-to-image export.
- No emoji anywhere. No third-party icon font. If a real set is ever needed, add a thin-stroke
  line set (e.g. Lucide) and document it — but default to the marks above.

---

## 10. Content & voice

- **Voice:** plain, calm, operator-grade. Short declarative sentences. Explain consequences
  ("They lose access immediately and are removed from all groups.").
- **Person:** address the user as **you**; refer to people by name ("Tom Riley re-enrols at
  next sign-in").
- **Casing:** Sentence case for headings, body, buttons. UPPERCASE only for mono labels.
- **Buttons:** verb-first, concise — "Add person", "Send reset link", "Verify & continue".
  Destructive verbs are explicit — "Delete group", "Remove person".
- **Status words:** Ready · Draft · Maintenance · Down · Pending · Active · Disabled. Prefix
  live/critical states with `●` ("● READY", "● UNDER MAINTENANCE").
- **Eyebrows:** a mono uppercase kicker labels a moment ("RESET LINK SENT", "TWO-FACTOR").
- **No emoji.** No marketing tone. No "Oops!". Errors are factual ("Incorrect code — 4
  attempts left.").
- **Numbers / IDs / time are mono** ("MX-44192", "2h ago", "5 OF 8 SHOWN", "482913").

---

## 11. Theming

Dark mode is driven by a **`data-theme` attribute** on a container (or the root). The entire
token set (`:root` ⇄ `[data-theme="dark"]`) flips with it — no component-level work, no
per-component dark styles. Set `data-theme="dark"` and everything tracks. If your CSS
framework has a `dark:` variant, alias it to the same `[data-theme="dark"]` selector so
utilities and tokens stay in lockstep.
