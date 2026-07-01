---
kind: ticket
title: "05 · Account & sessions"
status: 2
---

# 05 · Account & sessions

Customer self-service account management (FR-ACCT).

## Scope — in

- **Profile** (FR-ACCT-01): initials avatar, email + role display, editable display name (`user.name`).
- **Change password** (FR-ACCT-02): current password + new (≥3) + matching confirm; field-level errors block save; success toast. (Reuses the change-password mechanism from ticket 04.)
- **Devices & sessions** (FR-ACCT-03): list active sessions (current device marked, from the `session` table's ip/userAgent), sign out an individual device, sign out all other devices — destructive actions confirm first.

## Scope — out

- Remembered-devices / 2FA controls (deferred — 2FA-tied). Admin-initiated force-sign-out (ticket 06).

## Governs

[tech-plan](../../tech-plan/index.md) (Devices & sessions), [data-model](../../tech-plan/data-model/index.md) (session table). Technical approach: [account-sessions plan](../../tech-plan/account-sessions/index.md).

## Depends on

[03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md), [04 · Auth flows & screens](../04-auth-flows-screens/index.md).

## Acceptance / guardrails

- Session list/revoke uses better-auth `listSessions` / `revokeSession` / `revokeOtherSessions`.
- Destructive actions route through the shared confirm dialog (ticket 02).
