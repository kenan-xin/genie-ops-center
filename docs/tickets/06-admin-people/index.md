---
kind: ticket
title: "06 · Admin: People"
status: 0
---

# 06 · Admin: People

The People directory and person lifecycle (FR-ADM-P).

## Scope — in

- **Directory** (FR-ADM-P-01): name, email, role, status (Active/Disabled/Pending — _derived_), group-membership chips, last-active; search by name/email/role; sort by name/role/status.
- **Invite** (FR-ADM-P-02): name + email + role → `createUser` **with a generated throwaway password** → email better-auth's reset link as "set your password"; person created `pending`; confirmation toast.
- **Edit** (FR-ADM-P-03): name/email/role.
- **Lifecycle** (FR-ADM-P-04): disable/enable (`banUser`/`unbanUser`); for pending, activate or resend invite.
- **Account-security actions** (FR-ADM-P-05): admin reset password (email reset link or set temp password + force-change), force sign-out of all sessions. _(Reset-MFA deferred with 2FA.)_
- **Remove** (FR-ADM-P-06): confirm; cascade strips `group_member` rows.
- **Jump to group** (FR-ADM-P-07) from a person into the group inspector.

## Scope — out

- Group inspector itself (ticket 07). MFA reset (deferred).

## Governs

[tech-plan](../../tech-plan/index.md) (Person lifecycle), [data-model](../../tech-plan/data-model/index.md).

## Depends on

[02 · Ledger component kit](../02-ledger-component-kit/index.md), [03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md). Invite uses the set-password flow from [04](../04-auth-flows-screens/index.md).

## Acceptance / guardrails

- **All** better-auth admin mutations go through the single domain service (no raw `banUser`/`createUser` in UI procedures); status stays derived (no "disabled" written to `status`).
- Every destructive action (remove, force-sign-out, disable) routes through the shared confirm dialog with consequence copy.
