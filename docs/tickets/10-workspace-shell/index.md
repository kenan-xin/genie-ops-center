---
kind: ticket
title: "10 · Workspace shell & chrome"
status: 0
---

# 10 · Workspace shell & chrome

The customer-facing shell that hosts the hub and viewer (NFR-RES, FR-VIEW-06/07).

## Scope — in
- Responsive layout: persistent **212px sidebar** above 920px, **off-canvas drawer + backdrop** below (hamburger); content-width tiers scale per breakpoint.
- Nav: Solutions / Recent / Favorites / Account; current-selection styling (brand). Customer-neutral copy, **no admin affordances** leak in (NFR-CONTENT-01).
- **Presentation chrome modes** (FR-VIEW-06): sidebar toggle, standalone (sidebar+header hidden), present/full-screen — each reversible.
- **Offline indicator** (FR-VIEW-07): fixed top bar driven by real `online`/`offline` events.
- **Server auth gate on the workspace layout** (carried from the whole-repo review): split the current client-only shell into a **server layout** + a **client chrome component**. The server layout calls `getServerAuth(await headers())` and redirects unauthenticated → `/login`, `password-change-required` → `/change-password` before rendering — so every workspace page (hub, recent, favorites, account, `/s/[slug]`) inherits the boundary and a future data-bearing RSC can't accidentally sit behind a public shell. (Mirrors what `(admin)/layout.tsx` already does.)

## Scope — out
- The hub list and viewer content (tickets 11/12). Admin shell (its own layout in phase 2).

## Governs
[tech-plan](../../tech-plan/index.md) (App structure), [design-package](../../design-package/index.md) (layout/chrome).

## Depends on
[02 · Ledger component kit](../02-ledger-component-kit/index.md), [03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md).

## Acceptance / guardrails
- The customer surface and admin portal stay cleanly separated; the customer chrome exposes no admin nav/affordances.
- Reflow verified at the documented breakpoints (≤920 drawer, ≥1180 second-column rail).
