---
kind: ticket
title: "02 · Ledger component kit"
status: 2
---

# 02 · Ledger component kit

The reusable Ledger-styled UI primitives every admin/workspace screen depends on. Built on shadcn-on-Base UI.

## Scope — in

- Primitives per the [Ledger design system](../../design-package/design-system/readme.md): Button (primary/dark/ghost/destructive/text), Input, Select (CSS-triangle caret), Toggle (the only pill), Segmented control, Tabs, Card, Table row + scroll container, **Dialog/confirm** (shared danger-confirm for all destructive actions — FR-SYS-02), Slide-over, **Toast** (auto-dismiss ~4s, manual dismiss — FR-SYS-01), Status badge (`●` live states), Empty state, Skeleton/spinner, **dual-list transfer** component (Available ⇄ Granted, multi-select, select-all, search per side).
- A11y baseline: visible focus rings, honor `prefers-reduced-motion`, adequate touch targets (NFR-A11Y-01).
- **Form controls are react-hook-form-compatible**: `forwardRef` + standard `name`/`value`/`onChange`/`onBlur` props (or a documented `Controller` pattern) so `register()` / `Controller` work cleanly with the rhf + zod forms used in later tickets.

## Scope — out

- Chat-specific components (AI Elements, ticket 14). Page composition (later tickets).

## Governs

[design-package](../../design-package/index.md) (Ledger "COMPONENTS" recipes), [tech-plan](../../tech-plan/index.md).

## Depends on

[01 · Scaffold & infra](../01-scaffold-infra/index.md).

## Acceptance / guardrails

- Square corners (radius 0–3px; pill only on Toggle), hairline keylines over shadows, mono uppercase labels, motion .15–.22s and disabled under reduced-motion.
- The confirm dialog and toast are single shared components reused everywhere (not re-implemented per screen).
- The dual-list transfer is generic (reused by Groups↔Solutions and Groups↔Members in ticket 07).
