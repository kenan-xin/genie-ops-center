---
kind: spec
title: "Design Package (Reference)"
---

# Design Package — Reference

The original Claude Design output for the prototype. The **interactive prototype, style guide, requirements spec, and design-system tokens are tracked here in-repo** — they are the **screen source of truth**: before implementing or reviewing any screen, open `Genie Control Station.dc.html` (+ `Genie Style Guide.dc.html` for component recipes) and lift the exact layout / IA / copy / values (it's one self-contained HTML doc — grep it by the screen's heading). Tokens are the _how_; the prototype is the _what_. This is **source reference**, not a planning artifact — read the _Genie Workspace — Epic Brief_ for what production actually does, and its **Prototype → production deltas** table for where production intentionally diverges (naming, no MFA, real data).

> ⚠️ These files use prototype-era names ("Genie Control Station", "Demo Hub") and some stale font references. Production naming is **Genie Workspace**. The app loads **Archivo / Hanken Grotesk / IBM Plex Mono** in `src/app/layout.tsx`; shipped tokens live in `src/app/globals.css`. The `design-system/tokens/` Geist mirror is not imported by the app. See the [implementation reference](./design-system/implementation.md). When a doc conflicts with the brief, the brief wins.

## Authoritative sources

| File                                   | What it is                                                                                                                                    | Use for                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Genie Control Station.dc.html` (244K) | The full interactive **prototype** — auth, workspace, viewer, admin console.                                                                  | Source of truth for **behavior & UX** — lift exact interactions/values from here.                                      |
| `Requirements Spec.dc.html` (44K)      | Reverse-engineered **FR/NFR spec** (stable requirement IDs).                                                                                  | The behavior checklist — interaction reference, superseded only where the brief's deltas say so.                       |
| `Genie Style Guide.dc.html` (48K)      | The living **"Ledger" visual spec** — renders every foundation + component.                                                                   | Visual reference.                                                                                                      |
| `design-system/`                       | The **maintained design system**: `styles.css` → `tokens/{colors,typography,spacing,fonts}.css`, plus `readme.md` + `SKILL.md`.               | Design reference and token mirror; shipped values come from `src/app/globals.css` and the implementation reference. |
| `CLAUDE.md`                            | Prototype product rules (customer-vs-admin separation, theming Chat-only, access via groups, Ledger aesthetic).                               | Product-rule reference.                                                                                                |
| `screenshots/` (139 PNGs)              | Captured prototype screens across breakpoints (`01-`/`02-`/`03-` = mobile/desktop/wide tiers; e.g. `02-p4-hub`, `02-p4-chat`, `02-ov-fixed`). | Visual ground-truth for each screen.                                                                                   |

> **In-repo (tracked here):** the three `.dc.html` files above + `design-system/`. **Artifacts-only** (not mirrored — large binaries / design-process tooling): `screenshots/` (139 PNGs, ≈3.7 MB), `CLAUDE.md`, `support.js`, `uploads/` — they live in the Traycer epic's `artifacts/design-package/` if ever needed.

## Prototype runtime & designer tooling (not product spec)

Support files that ship with the package but don't define product behavior — background only.

| File                                         | What it is                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `support.js` (~1.6k lines)                   | The prototype's **generated runtime** (from `dc-runtime/src/*.ts`) that drives the `.dc.html` interactions. Reference for how the prototype behaves; not code we carry over.                                      |
| `uploads/unslop/` + `unslop-ui.skill`        | The **"unslop-ui" skill** the designer used to strip AI-generated visual tells (`SKILL.md`, `references/{choosing-a-look,tells}.md`, `scripts/devibe_scan.py`). Design-process tooling, not product requirements. |
| `uploads/draw-*.png`, `uploads/pasted-*.png` | Designer scratch images pasted during the design session.                                                                                                                                                         |

> **Sync note:** verified against the updated package (`Genie Control Station Design.zip`, 2026-07-02 21:27) — all authoritative files tracked here (the three `.dc.html`, `design-system/` tokens) are **byte-identical** to the zip; no content change. (Prior sync 2026-06-30 17:29 dropped 5 non-binding exploration docs — Access Redesign, Build Roadmap, Chrome Options, Look and Feel v5, Type Scale Re-tune — recoverable from an earlier zip if ever needed.) The Epic Brief and chat-API contract are unaffected.

## Reading HTML docs

The `.dc.html` files are self-contained Claude Design exports. Open in a browser, or strip tags for text:
`python3 -c "import re,html;t=open('docs/design-package/Requirements Spec.dc.html').read();t=re.sub(r'<[^>]+>',' ',t);print(html.unescape(re.sub(r'\s+',' ',t)))"`
