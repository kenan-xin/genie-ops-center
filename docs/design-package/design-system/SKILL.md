---
name: genie-design
description: Use this skill to generate well-branded interfaces and assets for Genie Workspace, either for production or throwaway prototypes/mocks. Contains the "Ledger" design guidelines, color & type tokens, fonts, iconography rules, and component recipes for designing and prototyping.
user-invocable: true
---

Read `readme.md` in this folder first, then load `styles.css` (it `@import`s all tokens + fonts) so designs pick up the real custom properties. The living visual spec is `../Genie Style Guide.dc.html`.

Core rules to honor every time:
- Aesthetic is **"Ledger"** — firm, square-ish corners (radius 0–3px; pills for toggles only), hairline keylines over shadows, monospace uppercase labels, brand blue `#2360c4` only for primary action + selection, all other color strictly semantic.
- Fonts: Geist (display + UI/body, by weight), Geist Mono (data/labels).
- Responsive type & layout: every size and key container width is a stepped token (mobile→4K). Use the `--t-*` / `--m-*` / container tokens from `tokens/`; never hard-code px font sizes.
- No gradients, no emoji, no decorative circles/glyph badges. Status moments lead with a mono eyebrow. Sentence-case copy; UPPERCASE only for mono labels.
- This system spans many apps under **Genie Workspace** — keep copy product-neutral. Do not reference "Genie Control Station", "agents hub", or "demo-management console".

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and produce static HTML that links `styles.css`. If working in production code, copy the tokens and follow the rules to design as an expert in this brand. If invoked with no other guidance, ask what they want to build, ask a few questions, and act as an expert designer who outputs HTML artifacts or production code as needed.
