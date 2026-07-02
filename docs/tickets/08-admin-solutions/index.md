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
- **Configure** (FR-ADM-S-03): for Chat & Embedded — welcome message, starter prompts, feedback toggle; **Chat** additionally stores `botUuid`, **the per-solution streaming API endpoint** (`config.apiEndpoint`, default `https://dev-genie.001.gs/public-api/v2/workflow/chatbot/chats`), and binds a theme (live preview reflects the bound theme); **Embedded** stores the HTTPS `iframeUrl`. Native not configurable. All type-specific fields validated per type into `solution.config` (zod discriminated union).
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
- `botUuid`, `apiEndpoint`, and `iframeUrl` are config fields used server-side only (chat proxy / iframe src); never exposed beyond what the surface needs.
- **`apiEndpoint` trust = ops allow-list.** It's per-solution config (not an app-wide env), and its **origin must be on `GENIE_CHAT_API_ALLOWED_ORIGINS`** — enforced server-side at write via `assertAllowedEndpoint` (`src/lib/url-guard.ts`), on top of the shared schema's https+non-private check. The list is also the default-seed + rotation point; the chat proxy re-checks it before the fetch (ticket 13). Changing `apiEndpoint`/`botUuid` bumps `solution.chatConfigVersion` so a stale conversation handle can't bind to the new backend. The Configure slide-over renders the endpoint field (critique H1 — resolved), so admins can view/rotate it.
- Delete cascades `group_solution` (and `favorite`/`recent`) rows.
