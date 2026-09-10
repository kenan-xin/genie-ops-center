---
name: genie-design
description: Use this skill to generate well-branded interfaces and assets for Genie Workspace, either for production or throwaway prototypes/mocks. Contains the "Ledger" design guidelines, color & type tokens, fonts, iconography rules, and component recipes for designing and prototyping.
user-invocable: true
---

Read `readme.md` and `implementation.md` in this folder first. Before building or reviewing a screen, open `../Genie Control Station.dc.html` and `../Genie Style Guide.dc.html` for its layout, copy and component recipes. For production tokens, read `../../../src/app/globals.css`; the font loader is `../../../src/app/layout.tsx`. The standalone `styles.css` / `tokens/` mirror retains older Geist fonts and is not imported by the app.

Core rules to honor every time:
- Aesthetic is **"Ledger"** — firm, square-ish corners (radius 0–3px; pills for toggles only), hairline keylines over shadows, monospace uppercase labels, brand blue `#2360c4` only for primary action + selection, all other color strictly semantic.
- Fonts: Archivo (display), Hanken Grotesk (UI/body), IBM Plex Mono (data/labels). Use the existing font variables and utilities in production.
- Responsive type & layout: every size and key container width is a stepped token (mobile→4K). Use the `--t-*` / `--m-*` / container tokens from the shipped `globals.css`; never hard-code px font sizes.
- No gradients, no emoji, no decorative circles/glyph badges. Status moments lead with a mono eyebrow. Sentence-case copy; UPPERCASE only for mono labels.
- This system spans many apps under **Genie Workspace** — keep copy product-neutral. Do not reference "Genie Control Station", "agents hub", or "demo-management console".

For static HTML mocks, copy the needed shipped token values and load the three current font families. Use the legacy `styles.css` only when intentionally reproducing the older mirror, and identify that difference. In production, reuse the existing Ledger utilities and `src/components/ui` components rather than copying another token layer. Verify the result against the relevant prototype screen and current component APIs.
