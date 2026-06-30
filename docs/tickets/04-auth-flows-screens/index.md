---
kind: ticket
title: "04 · Auth flows & screens"
status: 0
---

# 04 · Auth flows & screens

The customer + admin entry screens on top of the identity foundation.

## Scope — in

- **Sign-in** (`/login`): email+password, inline empty-field errors (FR-AUTH-01, minus the 2FA step — goes straight to a session).
- **Admin sign-in** (`/admin/login`): same credentials, **UX routing only** — routes admins to `/admin`, rejects non-admins (FR-AUTH-02).
- **Forgot password** flow (FR-AUTH-03): enter email → "link sent" → set new password (live strength meter, must reach ≥ "Good", confirm matches) → success.
- **Set password** (`/set-password?token`): the invite-activation landing — on success flips `pending→active` via the `onPasswordReset` path; also the destination for `mustChangePassword` users.
- **Change password** (in-session) with current-password check; shared zod strength schema (≥3) drives both meter and server.
- **Idle-timeout modal** (FR-AUTH-04): 60s countdown warning, "Stay signed in" pings to refresh, timeout/sign-out clears transient state and returns to sign-in (FR-AUTH-05).

## Scope — out

- Admin-side invite _trigger_ (ticket 06). Account profile / devices (ticket 05).

## Governs

[tech-plan](../../tech-plan/index.md) (Person lifecycle, Sessions), design-package auth screens.

## Depends on

[02 · Ledger component kit](../02-ledger-component-kit/index.md), [03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md).

## Acceptance / guardrails

- A `pending` user cannot obtain a workspace session except on the set-password path; a `mustChangePassword` user is forced through change-password before any other action.
- Password strength rule (≥3 of length≥8 / mixed case / digit / symbol) enforced server-side, not just in the meter.
