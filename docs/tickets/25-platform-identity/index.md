---
kind: ticket
title: "25 · Platform identity invariants (protected admin + Everyone group)"
status: 0
---

# 25 · Platform identity invariants

Two system-managed invariants the platform must always hold, independent of any feature: a **protected admin account** that always exists and can't be locked out, and an **Everyone group** that provably contains every user at all times. Prerequisite for native solutions (ticket 24 grants native to Everyone).

Governs: [tech-plan/platform-identity](../../tech-plan/platform-identity/index.md).

## Scope — in

- **Schema:** add `user.protected boolean default false` and `group.system boolean default false` (one additive migration). `protected` is the stable identity anchor for the admin; `system` marks the Everyone group.
- **Boot rewrite — `ensureSystemInvariants()`:** replace `bootstrapAdmin`'s single `if (existing) return` gate (`bootstrap.ts:28-31`) with three independently idempotent ensures, run from the entrypoint under the advisory lock, in order: (1) `ensureEveryoneGroup()` (system=true, before any user), (2) `ensureProtectedAdmin()` (create from `ADMIN_EMAIL` + flag **only if no `protected` user exists**), (3) `backfillEveryoneMembership()` (add every existing user, `onConflictDoNothing`).
- **Everyone auto-join:** `databaseHooks.user.create.after` in `auth.ts` inserts the Everyone membership (catches bootstrap + invite — both go through `auth.api.createUser`).
- **Protected-admin enforcement (better-auth layer):** `databaseHooks.user.delete.before` (reject delete of a `protected` user) + `user.update.before` (field-aware: reject only `banned = true` or dropping `admin` from `role` on a protected user; allow email/name/password). Optional endpoint `hooks.before` matcher on `/admin/{set-role,ban-user,remove-user}` as belt-and-suspenders.
- **Group locks:** `setMembers` ignores/rejects membership edits when `group.system`; `deleteGroup` + rename reject when `group.system`.
- **UI:** Everyone shown as all-users / read-only in the groups admin; protected-admin delete/ban/demote actions disabled (row marked) in People.

## Scope — out

- Native solutions (ticket 24) — this only provides the Everyone group they grant to.
- Any change to the access predicate: Everyone is **materialized**, so `isGrantedSolution` / `customerVisible` are unchanged.

## Depends on

- [03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md) (user/group tables, better-auth admin plugin), [03b · Docker runtime](../03b-docker-runtime/index.md) (entrypoint boot sequence).

## Acceptance / guardrails (critique findings)

- **F1 — no bypass:** delete/ban/demote of the protected admin is rejected on **every** path — tRPC `users.*` *and* a direct `/api/auth/admin/*` HTTP call — because enforcement lives in the DB hooks both paths cross (`internalAdapter.updateUser`/`deleteUser`). A `curl` to the admin endpoint must fail closed.
- **F2 — editable email, no duplicate:** the protected admin's email/name/password are editable; identity is anchored on the `protected` flag, so changing the email (or a different `ADMIN_EMAIL` on redeploy) never mints a second protected admin.
- **F7 — idempotent boot:** `ensureSystemInvariants()` is three independent idempotent steps; re-running on every boot is safe and self-heals drift (a user missing from Everyone is re-added).
- **F15 — Access-Overview scale:** a solution granted to Everyone renders every org user in the Access-Overview "who has access" view — cap/paginate the member list for `system` (or large) groups, or explicitly accept as a foundation trade-off.
- Fails closed on every guarded mutation with a clear error.
