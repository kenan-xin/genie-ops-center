---
kind: ticket
title: "12 · Viewer shell + status + embedded"
status: 0
---

# 12 · Viewer shell + status + embedded

The `/s/[slug]` viewer that hosts each solution type, with status gating and the embedded (iframe) experience. Chat content is ticket 14.

## Scope — in

- **Viewer route** `/s/[slug]`: resolves the solution, applies `assertCanSee` (render) and `assertCanRun` (live experience); records the open to `recent`.
- **Status gating** (FR-VIEW-05): `Maintenance`/`Down` render a non-interactive status notice instead of the live experience; `Draft` not openable at all.
- **Embedded (Smart-API)** (FR-VIEW-04): render the external app in a sandboxed `<iframe>` by per-solution `iframeUrl`; loading + error states with retry; reload control. CSP `frame-src` from `ALLOWED_IFRAME_ORIGINS` allow-list.
- **Native**: not openable in foundation (enum only) — hidden from the catalogue; no live path.

## Scope — out

- The chat experience (tickets 13/14) — this ticket provides the shell slot the chat UI mounts into.

## Governs

[tech-plan](../../tech-plan/index.md) (see/run guards, Embedded), [data-model](../../tech-plan/data-model/index.md).

## Depends on

[11 · Solutions hub + Recent/Favorites](../11-solutions-hub/index.md), [08 · Admin: Solutions](../08-admin-solutions/index.md).

## Acceptance / guardrails (critique invariant)

- `assertCanSee` allows rendering the shell + status notice; **`assertCanRun` (grant + not archived + `status=ready`) is required before any live experience** (iframe load) — the two guards are distinct and both enforced server-side.
- Iframe uses an explicit `sandbox` policy and a non-wildcard CSP `frame-src` allow-list; no SSO/token handoff.
