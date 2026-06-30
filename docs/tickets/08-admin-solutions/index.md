---
kind: ticket
title: "08 · Admin: Solutions"
status: 0
---

# 08 · Admin: Solutions

Register and configure solutions (FR-ADM-S).

## Scope — in

- **Table** (FR-ADM-S-01): name, type, inline status selector (Ready/Draft/Maintenance/Down); search, type-filter, sort; row actions menu.
- **Register** (FR-ADM-S-02): name required → URL slug derived; type (Chat/Native/Embedded); description; created as **Draft**. (Native registration **hidden** in foundation.)
- **Configure** (FR-ADM-S-03): for Chat & Embedded — welcome message, starter prompts, feedback toggle; **Chat** additionally stores `botUuid` and binds a theme (live preview reflects the bound theme); **Embedded** stores the HTTPS `iframeUrl`. Native not configurable. All type-specific fields validated per type into `solution.config` (zod discriminated union).
- **Row actions** (FR-ADM-S-04): duplicate (Draft copy), archive/unarchive, delete (confirm; cascade revokes from every group via `group_solution`).
- **Status governs availability** (FR-ADM-S-05) — drives the see/run gating in the viewer.

## Scope — out

- Theme management/editor (ticket 09 — this ticket only _binds_ a theme). The customer viewer (phase 3).

## Governs

[tech-plan](../../tech-plan/index.md), [data-model](../../tech-plan/data-model/index.md) (`solution`, `config` shapes).

## Depends on

[03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md). Theme-bind sub-feature depends on [09 · Admin: Themes](../09-admin-themes/index.md).

## Acceptance / guardrails

- `solution.config` validated by a per-type zod discriminated union; `themeId` settable only when `type='chat'`.
- `botUuid` and `iframeUrl` are config fields used server-side only (chat proxy / iframe src); never exposed beyond what the surface needs.
- Delete cascades `group_solution` (and `favorite`/`recent`) rows.
