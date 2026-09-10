---
kind: ticket
title: "10b · Access-path indexes"
status: 2
---

# 10b · Access-path indexes

Add the inverse-direction indexes the authorization/access predicates will hit on every hub, viewer, recent/favorites, and chat request. **Land before tickets 06–10 add real data volume** (deferred from the whole-repo review).

## Scope — in
The domain join tables use composite primary keys whose leading column is `group_id` (for the grant/membership tables) or `user_id`. The hot access paths filter the *other* column, so add Drizzle indexes (→ a new `drizzle-kit generate` migration) for:

- `group_member(user_id, group_id)` — `isGrantedSolution` / `assertCanSee` join from the user side.
- `group_solution(solution_id, group_id)` — the "which groups grant this solution" / access-overview direction.
- `recent(user_id, opened_at desc)` — the top-6 recents query (the `(user_id, solution_id)` PK doesn't help the time-ordered read).
- `chat_session_handle(userId, solutionId)` — already the PK, so **no** extra index; note here so it isn't re-added.
- `favorite(user_id, solution_id)` — already the PK; the favorites list reads by `user_id` (leading column), so **no** extra index needed.

Keep `solution.archived` / `solution.status` / `solution.slug` in mind: add a `solution(slug)` unique index if not already implied by the unique constraint, and consider partial indexes on `status`/`archived` only if the hub query's filter selectivity warrants it once there's data — default to not pre-optimizing.

## Scope — out
- Better-auth tables (their indexes are generated).
- Enum/check constraints on `user.status` / `solution.type` / `solution.status` (the fail-closed *code* guard landed in ticket 04; the DB-level constraint is a separate hardening item — track separately if wanted).

## Governs
[data-model](../../tech-plan/data-model/index.md) (the join tables + PKs), whole-repo review (historical source absent from this checkout, finding #5).

## Depends on
[03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md). Migrations are additive (a new `drizzle-kit generate`); no data backfill.

## Acceptance / guardrails
- One new migration only; `drizzle-kit generate` SQL is reviewed (no hand-edits unless a partial index is justified).
- The committed migration applies cleanly on a fresh DB and `drizzle-kit` remains the sole migration owner.
- Verify the hot query shapes (`isGrantedSolution`, top-6 recents) would use the new indexes via `EXPLAIN` on representative data (small fixture), without regressing the existing smoke tests.
