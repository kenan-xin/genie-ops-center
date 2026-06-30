---
kind: ticket
title: "03 · Identity + schema + migrations"
status: 2
---

# 03 · Identity + schema + migrations

The keystone: identity, the full data model, and the authorization spine. After this, you can seed an admin and authenticate.

## Scope — in

- **better-auth** config: email/password; admin plugin with multi-value roles (`"user"` / `"user,admin"`, `adminRoles:["admin"]`); custom user fields `status` (`pending|active`), `mustChangePassword`; `revokeSessionsOnPasswordReset`; session `expiresIn=15m` + low `updateAge` (sliding idle) + **`cookieCache` off**; `session.create.before` hook blocking `pending` (except set-password path); `onPasswordReset` flips `pending→active`. Mount `/api/auth/[...all]`.
- **Schema** (Drizzle): better-auth-generated auth tables (CLI generates the source) + domain tables — `group`, `group_member`, `solution`, `group_solution`, `theme`, `favorite`, `recent`, `chat_session_handle` (with `generation`, nullable `externalSessionUuid`). One **single drizzle-kit migration history** (auth + domain); the migrate step (invoked by the [03b](../03b-docker-runtime/index.md) container entrypoint) is drizzle-only — never better-auth `migrate`.
- **Authorization**: tRPC context reads the better-auth session; `publicProcedure` → `protectedProcedure` → `adminProcedure`; centralized `can()` / `assertAdmin` / `assertCanSee` / `assertCanRun` guards; one **domain service** wrapping all better-auth admin calls.
- **Guarded bootstrap**: seed one `user,admin` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` only if `user` table empty; strength-validate; set `mustChangePassword`; log a one-time event.

## Scope — out

- UI screens (ticket 04+). Admin CRUD surfaces (phase 2).

## Governs

[tech-plan](../../tech-plan/index.md) (Auth/session/authz, Operational), [data-model](../../tech-plan/data-model/index.md).

## Depends on

[01 · Scaffold & infra](../01-scaffold-infra/index.md).

## Acceptance / guardrails (critique invariants)

- **Idle test**: activity before expiry extends the session; idle past 15m is rejected across **tRPC, RSC, and `/api/chat`** — not just navigation.
- **Limited-session enforcement is server-side, single-point**: `pending` blocked at `session.create.before`; `mustChangePassword` rejected at the shared session accessor used by RSC/tRPC/`/api/chat` (not page redirects). Tests hit those surfaces directly.
- **Status derived, not dual-written**: `disabled`←`banned`, `pending`←`status`, else `active`; raw better-auth admin calls only via the domain service.
- **One migration owner**: drizzle-kit; never run better-auth `migrate`. Foreign keys to `user.id` resolve.
- Bootstrap is idempotent (only when `user` empty) and rejects a weak `ADMIN_PASSWORD`.
