import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { chatSessionHandle } from "@/server/db/schema";

/**
 * `chat_session_handle` read/write helpers (tech-plan → "Conversation model").
 * Every write here is a single atomic statement — an `INSERT ... ON CONFLICT
 * ... DO UPDATE ... WHERE` or a plain conditional `UPDATE` — rather than a
 * read-then-write pair, so there's no TOCTOU window between the guard check
 * and the write for Postgres to race across concurrent requests.
 */

export type HandleSnapshot = {
  externalSessionUuid: string | null;
  generation: number;
};

/** Read the handle (or the implicit zero-state if no row exists yet). */
export async function loadHandle(userId: string, solutionId: string): Promise<HandleSnapshot> {
  const [row] = await db
    .select({
      externalSessionUuid: chatSessionHandle.externalSessionUuid,
      generation: chatSessionHandle.generation,
    })
    .from(chatSessionHandle)
    .where(and(eq(chatSessionHandle.userId, userId), eq(chatSessionHandle.solutionId, solutionId)))
    .limit(1);
  return row ?? { externalSessionUuid: null, generation: 0 };
}

/**
 * "New chat" (tech-plan → "Conversation model"): bump `generation` and null
 * `externalSessionUuid` in one atomic upsert. The next send reads the new
 * generation and an empty `sessionUUID` → the external API starts a fresh
 * conversation. Because persistence is generation-guarded, a response still
 * streaming from the *old* conversation can't resurrect it after this call.
 */
export async function resetChatSession(userId: string, solutionId: string): Promise<void> {
  await db
    .insert(chatSessionHandle)
    .values({ userId, solutionId, generation: 1, externalSessionUuid: null })
    .onConflictDoUpdate({
      target: [chatSessionHandle.userId, chatSessionHandle.solutionId],
      set: {
        generation: sql`${chatSessionHandle.generation} + 1`,
        externalSessionUuid: null,
        updatedAt: new Date(),
      },
    });
}

const DEFAULT_LEASE_TTL_MS = 60_000;

/**
 * Acquire the short-TTL in-flight send lease (tech-plan → "Lease storage",
 * critique B2). One atomic `INSERT ... ON CONFLICT DO UPDATE ... WHERE`:
 * the `setWhere` clause only fires the update when no unexpired lease is
 * held, so Postgres's own row-conflict handling — not app-level
 * check-then-write — is what makes this race-free. Returns `true` iff this
 * call won the lease (first send, or an existing lease was absent/expired).
 */
export async function acquireLease(
  userId: string,
  solutionId: string,
  leaseOwner: string,
  ttlMs = DEFAULT_LEASE_TTL_MS,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await db
    .insert(chatSessionHandle)
    .values({ userId, solutionId, leaseOwner, leaseExpiresAt: expiresAt })
    .onConflictDoUpdate({
      target: [chatSessionHandle.userId, chatSessionHandle.solutionId],
      set: { leaseOwner, leaseExpiresAt: expiresAt, updatedAt: new Date() },
      setWhere: sql`${chatSessionHandle.leaseOwner} is null or ${chatSessionHandle.leaseExpiresAt} is null or ${chatSessionHandle.leaseExpiresAt} < now()`,
    })
    .returning({ leaseOwner: chatSessionHandle.leaseOwner });
  // Verified against Postgres directly: when `setWhere` evaluates false for a
  // conflicting row, the statement affects (and RETURNS) zero rows — it does
  // NOT return the untouched pre-existing row. So row presence alone proves
  // we won the lease.
  return rows.length > 0;
}

/**
 * Release the lease — but ONLY if `leaseOwner` still matches (critique B2):
 * an old request's delayed `finally` must not clear a *newer* lease that
 * already took over after this request's TTL expired. A plain `UPDATE ...
 * WHERE leaseOwner = $1` is the atomic compare-and-clear; no read is needed
 * first because a mismatched WHERE just affects zero rows.
 */
export async function releaseLease(
  userId: string,
  solutionId: string,
  leaseOwner: string,
): Promise<void> {
  await db
    .update(chatSessionHandle)
    .set({ leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(chatSessionHandle.userId, userId),
        eq(chatSessionHandle.solutionId, solutionId),
        eq(chatSessionHandle.leaseOwner, leaseOwner),
      ),
    );
}

/**
 * Persist the returned conversation id — ONLY if both guards still hold at
 * completion (tech-plan → "Config-change invalidation", critique B3/H3):
 *  - `chatSessionHandle.generation` is unchanged since the read before the
 *    external call ("New chat" mid-stream must not be resurrected).
 *  - `solution.chatConfigVersion` is unchanged since the read before the
 *    external call (an admin endpoint/bot change mid-stream must not attach
 *    a stale conversation id to the new backend).
 *
 * Both checks ride in the WHERE of a single statement — the `chatConfigVersion`
 * comparison is a correlated subquery evaluated in the same statement, so
 * there's no separate read-then-write race window. Gating the `SELECT`
 * source (not just the conflict update) also covers the no-handle-row-yet
 * case: a first message at a since-changed config version produces zero
 * source rows, so no row is ever created for it (see implementation note).
 *
 * Returns `true` iff the conversation id was persisted.
 *
 * Implementation note: this MUST be `INSERT ... SELECT ... WHERE` (raw SQL),
 * not `INSERT ... VALUES ... ON CONFLICT DO UPDATE ... WHERE`. Drizzle's
 * builder only lets a `where` gate the UPDATE arm — on a fresh row (no
 * conflict) the plain `VALUES` insert would go through unconditionally,
 * which is exactly the no-handle-row-yet case this guard exists to close.
 * Gating the source `SELECT` itself makes both arms conditional: a `WHERE
 * false` source produces zero candidate rows, so neither the insert nor the
 * conflict/update path fires. Verified directly against Postgres (empty
 * `SELECT` source ⇒ 0 rows affected in both the insert and update arms).
 */
export async function persistConversationIfUnchanged(params: {
  userId: string;
  solutionId: string;
  externalSessionUuid: string;
  atGeneration: number;
  atChatConfigVersion: number;
}): Promise<boolean> {
  const { userId, solutionId, externalSessionUuid, atGeneration, atChatConfigVersion } = params;

  const result = await db.execute<{ external_session_uuid: string | null }>(sql`
    insert into chat_session_handle (user_id, solution_id, external_session_uuid, generation)
    select ${userId}, ${solutionId}, ${externalSessionUuid}, ${atGeneration}
    where (select chat_config_version from solution where id = ${solutionId}) = ${atChatConfigVersion}
    on conflict (user_id, solution_id) do update
      set external_session_uuid = excluded.external_session_uuid, updated_at = now()
      where chat_session_handle.generation = ${atGeneration}
        and (select chat_config_version from solution where id = ${solutionId}) = ${atChatConfigVersion}
    returning external_session_uuid
  `);

  return result.rows.length > 0;
}
