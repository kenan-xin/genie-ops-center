---
kind: ticket
title: "09 · Admin: Themes"
status: 2
---

# 09 · Admin: Themes

Theme management for Chat solutions (FR-ADM-T). Chat-only.

## Scope — in

- **Theme management** (FR-ADM-T-01): list, select, create, delete themes; each chat solution is assigned one theme.
- **Theme editing** (FR-ADM-T-02): Presets; Elements (header colour, user-bubble colour, corner radius, font, input placeholder); a Custom-CSS tab. Persists to `theme.config` (JSONB).
- **Live device preview** (FR-ADM-T-03): renders edits live, toggling desktop/mobile framing.

## Scope — out

- Binding a theme to a solution (ticket 08). Applying the theme in the live chat viewer (ticket 14 consumes `theme.config`).

## Governs

[tech-plan](../../tech-plan/index.md), [data-model](../../tech-plan/data-model/index.md) (`theme`).

## Depends on

[03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md), [02 · Ledger component kit](../02-ledger-component-kit/index.md).

## Acceptance / guardrails

- Themes apply to **Chat only** (enforced at the tRPC boundary, not just UI).
- Custom-CSS is scoped to the chat preview/surface and must not leak into the admin/workspace chrome.

## Audit (2026-07-02)

Substantively shipped. One open divergence from FR-ADM-T-01 ("each chat solution is assigned one theme"): `solution.themeId` is nullable (`src/server/db/schema.ts:70`) and the Configure form offers a "No theme" option (`themeId: z.uuid().nullish()` in `src/features/solutions/schemas/solution.ts:146`).

**Resolution (2026-07-02):** Owner decision — theme stays optional. "No theme" is a legitimate state (a chat solution may use the default chrome without a custom theme), and enforcing a required theme would be a breaking change for existing no-theme chat solutions. FR-ADM-T-01's "assigned one theme" is read as "each chat solution _may be_ assigned one theme." Ticket closed (`status: 2`).
