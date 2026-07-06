---
kind: reference
title: "Ledger Design System — Implementation Reference"
audience: engineers working in src/
---

# Ledger Design System — Implementation Reference

The sibling [`readme.md`](./readme.md) is the **visual spec** (aesthetic, voice, recipes). This
page is the **living implementation reference**: the tokens as actually shipped in
`src/app/globals.css`, and the React component kit in
[`src/components/ui/`](../../../src/components/ui/) with the real variants and props each
component accepts today. When the spec and the code disagree, **this page reflects the code** —
and the disagreement is logged in [§ Drift log](#drift-log) so it can be closed deliberately.

> **Read this first if** you are adding a new control, aligning a toolbar, or wondering "what
> token do I reach for." For *why* the system looks the way it does, read `readme.md`.

---

## 1. Where the tokens live

| Layer | File | Role |
| --- | --- | --- |
| **Token source of truth (shipped)** | `src/app/globals.css` | Every Ledger custom property that production actually resolves. `:root` (light) + `[data-theme="dark"]`. |
| Spec token mirror | `tokens/{colors,typography,spacing,fonts}.css` + `styles.css` | The spec package (self-contained, links Geist from Google Fonts). Used for throwaway HTML mocks. |
| Font loader | `src/app/layout.tsx` | Loads the three families via `next/font/google` and exposes them as `--font-archivo / --font-hanken / --font-plex-mono`. |
| Theme switch | `src/components/theme-provider.tsx` | `next-themes` toggles `data-theme` on `<html>`; the whole token set flips with it. |
| shadcn bridge | `globals.css` `:root` → `--background`/`--primary`/… | Maps shadcn semantic tokens onto Ledger once; dark mode tracks automatically. |

`globals.css` is authoritative. The `tokens/*.css` files are a **spec mirror** — they are *not*
imported by the app. If you change a value, change it in `globals.css` first.

---

## 2. Color tokens

Exactly two semantic directions in light mode: **cool near-white surfaces** and **one reserved
brand blue**. Everything else is semantic (success / warn / error), each paired with a tint.

### Light (`:root`)

| Token | Value | Used for |
| --- | --- | --- |
| `--ink` | `#14161b` | Primary text, dark fills, 2px rules, logo mark (`--chrome`) |
| `--ink2` | `#4a515c` | Secondary text |
| `--ink3` | `#8b929c` | Tertiary / muted labels, **placeholders**, caret triangles |
| `--faint` | `#aab0ba` | Disabled text, faint marks |
| `--on-ink` | `#ffffff` | Text/icons on `--ink` or `--brand` fills |
| `--bg` | `#fbfcfd` | App content background (cool near-white) |
| `--surface` | `#ffffff` | Cards, panels, inputs, chrome |
| `--panel` | `#f2f4f7` | Recessed/header fills, mono-icon tiles, hover fill |
| `--panel-chat` | `#f1f3f6` | Bot chat bubble (a shade darker than `--panel`) |
| `--line` | `#c8cdd5` | Standard hairline keyline |
| `--line2` | `#e2e5ea` | Lighter hairline — inner dividers, skeleton bars |
| `--rule` | `#14161b` | Heavy 2px section underline |
| `--sidebar` | `#ffffff` | Sidebar fill (matches `--surface`) |
| `--brand` | `#2360c4` | **Primary action + current selection only** (nav item, selected row, focus ring) |
| `--brandink` | `#2360c4` | Brand text (lightens to `#7fb2f0` in dark) |
| `--brandtint` | `#eef4fc` | Brand wash behind selection / callouts |
| `--onbrand` | `#ffffff` | Text on brand fill |
| `--success` / `--successtint` | `#1f9a5c` / `#eafaf1` | Ready · Active · On |
| `--warn` / `--warntint` | `#b07d10` / `#fbf3df` | Maintenance · Pending |
| `--error` / `--errortint` | `#d94032` / `#fbeae8` | Down · Failed · Delete |

### Dark (`[data-theme="dark"]`)

Same names, deep-slate base, brand text lightened. Full values live in `globals.css`; the only
additions vs. light are that `--panel-chat` matches `--panel` (no dark prototype ground truth, so
dark is kept unchanged). **No new token names exist in dark** — flip the attribute, never reach
for a different variable.

### Rules that don't appear as tokens

- **Brand blue is reserved.** Use `--brand` only for the primary action and current selection.
  Every other hue must be semantic (`--success` / `--warn` / `--error`). No decorative color, no
  gradients.
- **Status color never travels alone.** It always pairs foreground + tint (e.g. a `StatusBadge`
  is `text-[var(--success)]` on `bg-[var(--successtint)]`).
- **Chat tone spans are closed.** The external Genie API's inline `color:#hex` spans are
  rewritten by `rehype-sanitize` to `data-tone="success|warn|error|neutral"` (see `globals.css`
  `[data-tone]`). Never re-allow arbitrary `style`.

---

## 3. Typography

### Families (as shipped)

| Role token | Resolves to | next/font var | Used for |
| --- | --- | --- | --- |
| `--font-display` | `'Archivo', system-ui, sans-serif` | `--font-archivo` | Display/headlines, card & dialog titles (wt 700–800, tracking ≈ −0.02em) |
| `--font-ui` | `'Hanken Grotesk', system-ui, sans-serif` | `--font-hanken` | All UI + prose + body (wt 400–700). Tailwind `font-sans`. |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, monospace` | `--font-plex-mono` | Eyebrows, status, IDs, timestamps, counts, table headers. Tailwind `font-mono`. |

> ⚠️ **Font drift — see [Drift log](#drift-log) #1.** The spec (`readme.md`, `tokens/`, `SKILL.md`)
> names **Geist / Geist Mono**. The shipped product loads **Archivo / Hanken Grotesk / IBM Plex
> Mono**. Treat the code as correct; the spec prose is stale.

### The responsive scale (stepped, not fluid)

Type is **stepped**, not `clamp()`-fluid: every size jumps at a breakpoint and holds between. 12
role-name tokens alias to 8 `--fs-*` sizes, which derive from **just three knobs** via fixed
ratios. Each breakpoint sets only those three numbers, so the whole scale moves together —
nothing stays frozen tiny while its neighbours grow.

```
role tokens (alias, never redefined per breakpoint)
  --t-display  = --fs-xl      page / section display
  --t-h2       = --fs-xl      (alias of display)
  --t-cardhead = --fs-card    headings in fixed-width cards/dialogs
  --t-h3       = --fs-lg      sub-heads
  --t-title    = --fs-lg      (alias of h3)
  --t-body     = --fs-md      body + inputs (default reading size)
  --t-sm       = --fs-sm      small text
  --t-xs       = --fs-sm      (alias of sm)
  --m-xs / --m-sm = --fs-lbl        mono eyebrows
  --m-md         = --fs-lblmd      mono mid (counts)
  --m-lg         = --fs-lbllg      mono large (chips/data)

8 sizes from 3 knobs (fixed ratios)
  --fs-xl    = --base-h
  --fs-card  = --base-h × 0.78
  --fs-lg    = --base-h × 0.60
  --fs-md    = --base-b
  --fs-sm    = --base-b × 0.88
  --fs-lbl   = --base-l
  --fs-lblmd = --base-l × 1.13
  --fs-lbllg = --base-l × 1.27

3 knobs per breakpoint
  --base-h  (headings)   --base-b  (body)   --base-l  (labels)
```

| Breakpoint | `--base-h` | `--base-b` | `--base-l` |
| --- | --- | --- | --- |
| base (<480) | 25 | 15 | 11 |
| ≥480 | 26 | 15 | 11 |
| ≥768 | 28 | 15.5 | 11.5 |
| ≥1024 | 30 | 15.5 | 11.5 |
| ≥1280 | 31 | 16 | 12 |
| ≥1440 | 33 | 16 | 12 |
| ≥1920 | 37 | 17.5 | 13 |
| ≥2560 | 40 | 19 | 14 |

**Effective desktop scale** (≥1280: h=31, b=16, l=12): display/h2 **31px** · cardhead **24px** ·
h3/title **18.5px** · body **16px** · sm/xs **14px** · mono labels **12 / 13.5 / 15px**.

### Tailwind utilities

The scale is exposed as utilities in `globals.css` (`@theme inline`) so the kit never hard-codes a
px font size:

```
text-display  text-cardhead  text-title  text-body  text-small
text-mono-xs  text-mono-sm  text-mono-md  text-mono-lg
```

Plus `font-sans` (Hanken), `font-mono` (IBM Plex Mono), `font-heading` (Archivo).

### Hard rules

- **Never hard-code a px/rem font size.** Reach for a `--t-*` / `--m-*` token or its utility.
- **Never use `--t-display` inside a fixed-width card or dialog** — use `--t-cardhead` there.
- **Reshape a role across all tiers** by editing its ratio in the `--fs-*` block; **resize a
  whole group** by editing its `--base-*` knob. Don't fork a single breakpoint.
- **The mono eyebrow is the signature.** A mono uppercase kicker (`font: 600 var(--m-sm)
  var(--font-mono); letter-spacing: .06–.14em`) labels a moment and *replaces* decorative status
  icons. Live/critical statuses prefix with a `●` dot.

---

## 4. Spacing, radius, elevation, motion

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

--radius-0:    0px;   /* default — cards, inputs, badges, buttons */
--radius-1:    2px;   /* chips, small tiles */
--radius-2:    3px;   /* chat bubbles — the MAX radius for any content */
--radius-pill: 11px;  /* toggle tracks ONLY */

--shadow-toast:  0 8px 26px rgba(20,30,50,.16);
--shadow-dialog: 0 12px 34px rgba(20,30,50,.18);
--shadow-side:   -16px 0 40px rgba(20,30,50,.18);  /* right-edge slide-over */

--ease:     cubic-bezier(.4,0,.2,1);
--dur-fast: .15s;
--dur-base: .22s;   /* drawer / slide-over */
```

### Container widths (stepped with the type scale)

| Token | <480 | ≥1024 | ≥1280 | ≥1440 | ≥1920 | ≥2560 |
| --- | --- | --- | --- | --- | --- | --- |
| `--auth-w` | 400 | 440 | 460 | 480 | 520 | 600 |
| `--content-wide` (grid / dual-pane) | 1180 | 1240 | 1320 | 1400 | 1560 | 1880 |
| `--content-list` (single-column) | 1000 | 1060 | 1120 | 1200 | 1320 | 1500 |
| `--content-mid` (optional reading) | 900 | 960 | 1000 | 1080 | 1180 | 1320 |
| `--sidebar-w` | 212 | 212 | 212 | 236 | 264 | 320 |

`--auth-pad` also steps: `26px 22px 24px` (base) → `38px 38px 34px` (≥1024) → `48px 48px 44px`
(≥1920) → `56px 56px 52px` (≥2560).

### Rules

- **Square-ish by default.** Radius 0 on cards/inputs/badges/buttons; 3px max on content. The
  **11px pill is reserved exclusively for the `Switch` toggle** — never use `--radius-pill`
  anywhere else.
- **Flat by default.** Hairlines do the work; shadow appears only on lifted surfaces (toast,
  dialog, slide-over, dropdown menu).
- **Motion is short and mechanical.** `.15–.22s` with `cubic-bezier(.4,0,.2,1)`. No bounce, no
  scale-pop. Press = colour shift only (no shrink).
- **Reduced motion is global, not per-component.** `globals.css` collapses every animation/
  transition to `0.01ms` under `@media (prefers-reduced-motion: reduce)`. You do not need to
  re-guard individual components — but you *do* need to make sure your animation is non-essential
  (content stays visible with motion removed).
- **Focus ring is the shared form-control rule.** `outline: 2px solid var(--brand);
  outline-offset: -1px` on `:where(input, select, textarea):focus-visible` (in `globals.css`).
  Don't reinvent it per control.

### Layout reflow (direct CSS rules, not tokens)

Three breakpoint-gated layout classes live in `globals.css` and drive the shell reflow — apply the
class, don't reinvent the mechanism:

| Class | Behaviour |
| --- | --- |
| `.ws-side` / `.ws-burger` | Workspace shell sidebar. Off-canvas drawer (<920px) → static column at `--sidebar-w` (≥920px). |
| `.adm-side` / `.adm-burger` / `.adm-backdrop` | Admin shell. Same drawer mechanism, scoped so the two chromes can evolve independently. |
| `.cs-hubgrid` / `.cs-trow` / `.cs-thead` / `.csrow` / `.cs-hide` | Solutions hub catalogue. Rows stack as a flex list (<920px) → table-grid `2.4 .8 .8 .6 40` (≥920px); two-column hub (list + side-rail) turns on ≥1180px and widens to 4K. |
| `.cs-hubpad` | Hub content padding ladder: 24 → `34px 40px` → `40px 52px` → `48px 64px` → `60px 80px`. |
| `.acct-grid` | Account settings: sub-nav stacks above panel (<920px) → `248px` sub-nav column (≥920px). |

---

## 5. Control heights (shared scale — single source of truth)

**All form controls derive their height from one place:**
[`src/components/ui/control-size.ts`](../../../src/components/ui/control-size.ts).

```ts
export const CONTROL_HEIGHTS     = { sm: "h-8", md: "h-10", lg: "h-11" } as const; // 32 / 40 / 44
export const CONTROL_MIN_HEIGHTS = { sm: "min-h-8", md: "min-h-10", lg: "min-h-11" } as const;
export type ControlSize = keyof typeof CONTROL_HEIGHTS; // "sm" | "md" | "lg"
```

The values are **full Tailwind class literals** (so the JIT scanner picks them up at the
declaration site). `Button`, `Input`, `Select`, `SegmentedControl`, and `SearchInput` all read
from this scale.

### Rules

- **Never hard-code `h-8` / `h-10` / `h-11` on a control.** Use the scale.
- **Any horizontal row mixing control types** (search / input / select / segmented / button)
  renders every member at the same height. **The standard is 40px (`md`).**
- **`SegmentedControl` uses min-height**, not a fixed height, so long wrapped labels grow instead
  of clipping.
- **Deliberate compact exceptions** override via `className` (twMerge precedence) and must stay
  small — don't propagate them:
  - `transfer-list` pane search → `h-8` (32px)
  - inline table status-pill `Select` → `h-auto`
  - `Input`'s `inputSize="auth"` → `h-[42px]` + `text-title` (auth screens only, separate from the
    `sm/md/lg` scale)

---

## 6. Component kit

All components live in [`src/components/ui/`](../../../src/components/ui/). Built on
**@base-ui/react** primitives (Select, Switch, Dialog, Tabs, Tooltip, Toast, AlertDialog) +
**class-variance-authority** for variants. Composed with `cn`/`twMerge`.

### Controls

#### `Button`
Variants: `primary` (brand fill, white, wt 700) · `dark` (`--ink` fill) · `ghost` (transparent +
`--line` border, wt 600) · `destructive` (ghost shell, `--error` text) · `link` (brand, wt 600,
inline — no height/padding).
Sizes: `default` (40px, `px-18`) · `sm` (32px, `px-3`) · `auth` (**44px**, `text-title`) · `icon`
(`size-10`).
Press = colour shift (`hover:brightness-[0.94]` / `hover:opacity-90`), no shrink. Square corners.
```tsx
<Button variant="primary" size="default">Add person</Button>
<Button variant="destructive">Delete group</Button>
```

#### `Input`
`inputSize`: `default` (40px, `text-body`) · `auth` (`h-[42px]`, `text-title`). Hairline border,
square, 12px padding (`px-3`), placeholder = `--ink3`. Focus ring is the global form-control rule.
```tsx
<Input inputSize="auth" type="email" placeholder="you@company.com" />
```

#### `Textarea`
Same recipe as `Input`, multi-line, `min-h-24`, `resize-y`. Opt into mono per-instance via
`className="font-mono text-mono-sm"`.
```tsx
<Textarea className="font-mono text-mono-sm" />
```

#### `Select`
Props: `items: {value,label}[]`, `value`, `defaultValue`, `onValueChange`, `onBlur`, `placeholder`
("Select…"), `size` (`ControlSize`, default `md`), `disabled`, `name`, `required`, `form`,
`aria-label`. Trigger matches the input recipe; **pure-CSS triangle caret** (no SVG data-URI —
breaks html-to-image export). Popup = hairline-bordered lifted surface; selected item reads in
brand with a `✓` indicator. `onBlur` fires on popup close so react-hook-form `mode:"onBlur"`
validation works.
```tsx
<Select items={[{value:"active",label:"Active"}]} value={v} onValueChange={setV} />
```

#### `SearchInput`
Props: `value`, `onChange`, `placeholder`, `size` (`ControlSize`, default `md`), `aria-label`.
Bordered composite: hairline border, circle-outline glyph (CSS, not an icon), borderless inner
input. Default width `220px` (`max-w-[48vw]`), overridable via `className`.
```tsx
<SearchInput value={q} onChange={setQ} placeholder="Search people…" />
```

#### `SegmentedControl`
Props: `options: {value,label}[]`, `value`, `onValueChange`, `size` (`ControlSize`, default `md`),
`disabled`. Bordered row; active segment = `--ink` fill / white (brand stays reserved elsewhere);
dividers are `border-l:1px solid var(--line)`. Uses **min-height** so labels can wrap. `role="tablist"`.
```tsx
<SegmentedControl options={[{value:"all",label:"All"},{value:"mine",label:"Mine"}]} value={tab} onValueChange={setTab} />
```

#### `Switch`
The **only pill in the system**. 38×22 track (`--brand` on / `--line` off) + 18px white knob.
Built on `@base-ui/react/switch`.
```tsx
<Switch checked={on} onCheckedChange={setOn} />
```

### Labels & feedback

#### `Label`
Mono uppercase eyebrow — the Ledger field/section label. `font-mono`, `text-mono-xs`, wt 600,
`tracking-[0.1em]`, `--ink2`. Associate via `htmlFor`.
```tsx
<Label htmlFor="email">Email address</Label>
```

#### `FieldError`
Field-level error under an input. `text-small`, `--error`. Renders `null` if no message.
#### `FormError`
Form-level error banner (failed submit). `role="alert"`, hairline-boxed on `--errortint`, leading `!`.
#### `NoticeBanner`
Success/info banner (e.g. reset-link notice). `role="status"`, hairline-boxed on `--successtint`,
leading `✓`.
> All three live in `form-feedback.tsx` and are shared by auth + account forms — customer-safe,
> neutral copy (NFR-CONTENT-01).

#### `PasswordStrengthMeter`
Live UX meter (`aria-live="polite"`). 4 segments coloured weak/fair/good (`--error`/`--warn`/
`--success`) + a mono label. **Visualizes only** — the actual gate is the shared zod schema
(server + form). Shared by auth set/reset/change + account change-password.

### Surfaces & containers

#### `Card`
`1px solid var(--line)` on `--surface`, no radius, no shadow. Sub-parts: `CardHeader` (`p-5`,
flex-col gap-1) · `CardTitle` (`text-cardhead`, wt 800, tracking −0.02em) · `CardDescription`
(`text-small`, `--ink2`) · `CardContent` (`px-5 pb-5`) · `CardFooter` (right-aligned, top border
on `--line2`, `p-4`).
> Nested cards are always wrong. Cards are for contained surfaces, not for wrapping every section.

#### `StatusBadge`
Mono uppercase on a semantic tint, square. `tone`: `success|warn|error|neutral|brand`. `variant`:
`solid` (filled tint) · `outline` (hairline tone-coloured border, transparent fill — a distinct
family, e.g. "THIS DEVICE"). `dot` prop prefixes a `●` for live/critical states.
```tsx
<StatusBadge tone="success" dot>Ready</StatusBadge>
<StatusBadge tone="brand" variant="outline">This device</StatusBadge>
```

#### `Chip`
**Mixed-case sans** (not mono), `1px` hairline border, `2px` radius, `--surface` fill. `tone`:
`neutral` · `brand` (brand border + `--brandtint` fill). `truncate` prop for long values. Distinct
from `StatusBadge` — **do not swap them**.

#### `EmptyState`
Props: `glyph` (default `∅`), `title`, `description`, `action?`. Dashed `1.5px` 42px square keyline
tile + glyph, `text-title` heading, muted body (`max-w-[42ch]`), optional CTA.

### Overlays & status

#### `Dialog` / `SlideOver`
Both built on `@base-ui/react/dialog`. Centered card (`Dialog`) and right-edge panel
(`SlideOver`), each with a `rgba(8,10,14,.45)` scrim (no blur), square corners, fade + slight
rise (`.2s`; disabled under reduced-motion via the global reset). `SlideOver` translates in from
the right with `--shadow-side`. Both expose `Header`/`Title`/`Description?`/`Body`/`Footer`
helpers; footers are right-aligned with a top border on `--line2`.

#### `ConfirmProvider` / `useConfirm`
The single shared danger-confirm (FR-SYS-02). **Mount `ConfirmProvider` once** near the root (it
is, in `src/components/providers.tsx`). Returns a `Promise<boolean>`.
```tsx
const confirm = useConfirm();
if (await confirm({ title: "Delete group?", description: "…", tone: "danger",
                    confirmLabel: "Delete group" })) { /* confirmed */ }
```
`tone: "danger"` renders a filled `--error` confirm button; default renders brand.

#### `ToastProvider` / `useToast`
Shared toast (FR-SYS-01). **Mount `ToastProvider` once** near the root. Auto-dismiss ~4s. `tone`:
`success|error|info`. Surface card + `4px` semantic left bar + mono mark (`✓` / `!` / `●`), fades
up 6px.
```tsx
const { toast } = useToast();
toast({ tone: "success", description: "Saved." });
```

#### `Tooltip`
Hairline, square corners, **`--ink`-dark fill** (matches toast's dark-on-light inversion), fade +
slight rise. `TooltipProvider` → `Tooltip` → `TooltipTrigger` → `TooltipContent`.

### Data & loading

#### `Table` family
`TableScroll` = bordered horizontal-scroll container (`overflow-x-auto`) — **always wrap a table
and give the table a `min-width`** so columns never crush on narrow screens. `TableHead` = mono
uppercase on `--panel` (`tracking-[0.07em]`, `--ink2`). `TableRow` = hairline-separated
(`--line2`), hover = `--panel` fill.

#### `Skeleton` / `Spinner`
`Skeleton` = shimmer bar on `--line2` (`cs-shimmer` keyframe, opacity `.45↔.9` over 1.1s).
`Spinner` = rotating ring (`<output>`, implicit `role="status"`), `--line2` track + `--brand` arc.

#### `Tabs`
Filled segmented strip attached to the panel below it — same recipe as `SegmentedControl` (active
= `--ink` fill / white). `Tabs` → `TabsList` (`divide-x` on `--line`) → `TabsTab` → `TabsPanel`.

#### `TransferList`
Dual-pane picklist (e.g. group membership). `items: TransferItem[]` with optional `mono` tile
glyph (falls back to initials). Pane search is `h-8` (the deliberate compact exception). Composes
`Button` + `Input` internally.

---

## 7. Theming & providers

`src/components/providers.tsx` mounts the app-wide client providers, in order:

```
ThemeProvider  →  TRPCReactProvider  →  ToastProvider  →  ConfirmProvider
```

- **`ThemeProvider`** wraps `next-themes` with `attribute="data-theme"`, `defaultTheme="system"`,
  `enableSystem`, `disableTransitionOnChange`. Toggling theme flips `data-theme` on `<html>`, and
  the entire token set (`:root` ⇄ `[data-theme="dark"]`) flips with it — no component-level work.
- **Tailwind's `dark:` variant** is aliased to the same selector in `globals.css`
  (`@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`), so `dark:`
  utilities and Ledger tokens stay in lockstep.

---

## 8. Drift log

Known disagreements between the spec (`readme.md` / `tokens/` / `SKILL.md`) and the shipped code.
Each entry says which side is currently authoritative. Resolve an entry by editing the losing side
and striking it out here.

1. **Typefaces.** Spec says **Geist / Geist Mono**; production ships **Archivo / Hanken Grotesk /
   IBM Plex Mono** (`layout.tsx`, `globals.css`). **Code is authoritative.** The spec prose is
   stale — commit `a8c2799` ("fix stale Geist … comments") is one of several cleanups of this
   same drift. The `design-package/index.md` note currently claims Geist is correct and Archivo is
   "wrong"; that claim is itself stale and should be flipped when the spec tokens are regenerated.
2. **`Button` auth size.** `readme.md` §COMPONENTS lists the auth input at 42px; the `Button`
   `auth` *size* is `CONTROL_HEIGHTS.lg` (**44px**), while the `Input` `auth` size is `h-[42px]`.
   The two "auth" values differ by design (button vs. input baseline) but the spec blurs them.
3. **`StatusBadge`.** Spec lists one filled-tint badge; the kit ships **two variants** — `solid`
   (filled tint) and `outline` (hairline tone-coloured border) — plus a `brand` tone. Spec needs
   the `outline` + `brand` additions.
4. **`Chip` vs. `Label`.** Both are small sans/mono labels but serve different roles: `Chip` is
   mixed-case sans (tags, counts); `Label` is mono uppercase (field eyebrows); `StatusBadge` is
   mono uppercase on a semantic tint. Spec groups them loosely; keep the three primitives
   separate in code.

---

## 9. Working agreement

- **Change tokens in `globals.css` first.** The `tokens/*.css` files are a spec mirror; sync them
  after, not before.
- **Don't add a new control height.** Extend `control-size.ts` if a genuinely new scale is needed,
  and document the reason here.
- **Don't introduce a new pill, gradient, or decorative status icon.** These are the system's
  hard bans (see `readme.md` §Absolute bans-equivalent) — status leads with a mono eyebrow, not a
  glyph badge.
- **When you add or change a component**, update §6 here in the same PR. The spec readme and this
  implementation reference must move together.
