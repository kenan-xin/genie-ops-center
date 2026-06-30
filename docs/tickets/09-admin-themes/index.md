---
kind: ticket
title: "09 · Admin: Themes"
status: 0
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
