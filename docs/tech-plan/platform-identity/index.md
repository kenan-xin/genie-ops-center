---
kind: spec
title: "Tech Plan — Platform identity invariants (protected admin + Everyone group)"
---

# Tech Plan — Platform identity invariants

Two system-managed invariants the platform must always hold, independent of any feature:

1. **A protected admin account** that always exists and can't be locked out.
2. **An `Everyone` group** that provably contains every user at all times.

Governs a new **ticket 25**, a prerequisite for [native-solutions](../native-solutions/index.md) (ticket 24), which uses `Everyone` as the default grant target. Both are net-new: today there is **zero** protection — any admin can delete/ban/demote any admin (including themselves), any group is deletable, group membership is a whole-set diff that can drop anyone, and new users join zero groups.

## Current state (grounded)

- Admin = the string `"admin"` inside the multi-value `user.role` (`src/server/db/auth-schema.ts:15`; parsed in `src/server/authz.ts:98-103`). No `isAdmin`/`protected` column.
- Bootstrap admin (`src/server/bootstrap.ts:20-53`) seeds from `ADMIN_EMAIL`/`ADMIN_PASSWORD` **only if the user table is empty** (guard keys on "any user exists", :28-31), runs every boot in the advisory-locked entrypoint (`src/server/entrypoint.ts:92-93`).
- `users` mutations (`src/features/users/server/router.ts`) — `remove` (:92), `disable`/ban (:56), `update`→role demote (:42-54) — are `adminProcedure` but have **no self-protection or last-admin guard**.
- `group` (`schema.ts:33-39`) has no `system`/`kind`/`slug` flag. `deleteGroup` (`group-service.ts:137`) deletes any group; membership is a whole-set diff via `setMembers` (`group-service.ts:144-167`) that removes anyone omitted.
- The only user-creation paths are bootstrap + invite, both via `auth.api.createUser`; there is **no `databaseHooks.user.create` hook** yet (`auth.ts:117-155`).

## Invariant A — protected admin account

One **designated** protected account (the bootstrap admin); other admins stay normal. Lock scope (owner pick): **un-deletable + un-bannable + un-demotable only** — name / email / password remain editable like any admin.

- **Marker:** add `protected boolean default false` to `user` (better-auth `additionalFields`, `input: false` like `status`; migration). Set `true` on the bootstrap admin.
- **Ensure-exists:** bootstrap changes from "seed if table empty" to "**ensure the protected admin exists** (by `ADMIN_EMAIL` identity), (re)creating and flagging it if absent." Still idempotent, still in the entrypoint.
- **Guards** (add to the three mutations): reject when the target user is `protected` —
  - `users.remove` → block delete.
  - `users.disable` → block ban.
  - `users.update` role branch → block demote (can't drop `admin`).
  - (name/email/password edits and `enable` remain allowed.)

## Invariant B — Everyone group (materialized, system-managed)

Access is `membership ∩ grant` through `groupMember`, so the cleanest design is a **materialized** group with real member rows — **no access-query change at all**; `Everyone` is just a group that always contains everyone, and grants to it work like any other group (this is how native gets its default reach).

- **Marker:** add `system boolean default false` to `group` (migration). Exactly one `system` group named `Everyone`.
- **Auto-join (new users):** add a `databaseHooks.user.create.after` in `src/server/auth.ts` — the *single* seam that catches both bootstrap and invite (both go through `auth.api.createUser`). It inserts the `Everyone` membership (`onConflictDoNothing`).
- **Seed + backfill (existing users):** in the entrypoint, ensure the `Everyone` group exists **before** the bootstrap admin is created, then backfill every existing user as a member — idempotent, under the same advisory lock.
- **Locks:**
  - `setMembers` (`group-service.ts:144`) → reject/ignore membership edits when the target group is `system` (the transfer-list can't drop anyone). The UI shows Everyone as all-users, read-only.
  - `deleteGroup` (`group-service.ts:137`) and rename → reject for a `system` group.
- **Still grantable:** only *membership* and *existence* are locked. Admins can grant/revoke solutions to `Everyone` normally (`setSolutions`), so native visibility stays per-group controllable.

## Data-model changes

| Table | Column | Purpose |
| --- | --- | --- |
| `user` | `protected boolean default false` | marks the un-deletable/-bannable/-demotable admin |
| `group` | `system boolean default false` | marks the `Everyone` group (locked membership/existence) |

One additive migration (a `drizzle-kit generate`); no data backfill in SQL — the row/membership seeding is the entrypoint's job so it also covers auto-join going forward.

## Enforcement seams

| Seam | File | Change |
| --- | --- | --- |
| New-user auto-join | `src/server/auth.ts:117` (`databaseHooks`) | add `user.create.after` → insert Everyone membership |
| Seed + backfill | `src/server/entrypoint.ts:79-95`, `src/server/bootstrap.ts` | ensure Everyone group (before admin) + backfill all users + ensure protected admin |
| Protected-admin guards | `src/features/users/server/router.ts:56,92` + role branch `:42-54` | reject delete/ban/demote on `protected` |
| Everyone membership lock | `src/features/groups/server/group-service.ts:144` (`setMembers`) | ignore/reject edits when `group.system` |
| Everyone existence lock | `group-service.ts:137` (`deleteGroup`) + rename | reject when `group.system` |

## Entrypoint sequence (order matters)

```mermaid
flowchart TD
  A["acquire advisory lock"] --> B["drizzle migrate (adds protected/system columns)"]
  B --> C["ensure Everyone group exists (system=true)"]
  C --> D["ensure protected admin exists (created → user.create.after auto-joins Everyone)"]
  D --> E["backfill: add every existing user to Everyone (onConflictDoNothing)"]
  E --> F["release lock → start server"]
```

Everyone must exist **before** any user is created so the `user.create.after` hook can add membership; the backfill then sweeps up pre-existing users idempotently.

## Failure handling

- **Hook fails / partial state:** the per-boot backfill is the safety net — it re-adds any user missing from Everyone, so drift self-heals on the next deploy.
- **Someone removed a member via a pre-guard path / old data:** backfill restores it.
- **Protected admin flag lost (legacy row):** ensure-exists re-flags the `ADMIN_EMAIL` account on boot.
- **Fails closed:** guards reject the mutation rather than silently allowing a lockout.

## Interaction with native solutions (ticket 24)

`sync-native-solutions.ts` grants native rows to the `Everyone` group on first creation. If ticket 25 isn't applied yet, that grant step no-ops with a warning and native reaches only explicitly-granted groups — native still functions, just without default-everyone reach.
