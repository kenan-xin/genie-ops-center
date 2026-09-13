import "server-only";

import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { favorite, recent, solution } from "@/server/db/schema";
import { assertCanSee, canSee } from "@/server/features/solution-access";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

import { resolveExplicitOrder } from "../lib/reorder";
import { listFavoriteSolutions, listHubSolutions, listRecentSolutions } from "./queries";
import {
  listHubSchema,
  recordRecentSchema,
  reorderFavoritesSchema,
  toggleFavoriteSchema,
} from "../schemas/hub";

/**
 * Customer-facing Solutions hub (FR-HUB). `protectedProcedure` — every signed-in
 * member sees their own granted set. The admin `solutionsRouter` owns create/
 * edit/status/archive; this router is read-only over the access-gated projection
 * plus the per-user favorite/recent cache.
 *
 * The critique invariant: hub, recent, and favorites all filter through the
 * same granted + unarchived + customer-visible predicate. Favorites/recents
 * mutations re-check `canSee` before writing, so starring/recording a solution
 * you can't open is a no-op/404, and a row whose access later lapses stops
 * rendering (queries.ts filters by the predicate, not by stored rows).
 */
export const solutionsHubRouter = createTRPCRouter({
  /** FR-HUB-01..06: the access-gated catalogue with search/type/sort. */
  list: protectedProcedure.input(listHubSchema.optional()).query(async ({ ctx, input }) => {
    return listHubSolutions(ctx.auth.user, input ?? {});
  }),

  /** FR-HUB-08: toggle the favorite star from the row. Re-checks access. */
  toggleFavorite: protectedProcedure
    .input(toggleFavoriteSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .select({
          id: solution.id,
          status: solution.status,
          archived: solution.archived,
        })
        .from(solution)
        .where(eq(solution.id, input.solutionId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
      // Only seeable solutions can be favorited — a favorited solution that
      // later becomes unseeable stops rendering via listFavoriteSolutions.
      const see = await canSee(ctx.auth.user, row);
      if (!see) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });

      const [existing] = await db
        .select({ solutionId: favorite.solutionId })
        .from(favorite)
        .where(and(eq(favorite.userId, ctx.auth.user.id), eq(favorite.solutionId, row.id)))
        .limit(1);

      if (existing) {
        await db
          .delete(favorite)
          .where(and(eq(favorite.userId, ctx.auth.user.id), eq(favorite.solutionId, row.id)));
        return { solutionId: row.id, isFavorite: false };
      }
      // Append to the end of the user's arrangement — MAX(position)+1, so a
      // newly starred solution lands last in the rail (design spec §5.2).
      await db
        .insert(favorite)
        .values({
          userId: ctx.auth.user.id,
          solutionId: row.id,
          position: sql<number>`coalesce((select max(${favorite.position}) from ${favorite} where ${favorite.userId} = ${ctx.auth.user.id}), -1) + 1`,
        })
        .onConflictDoNothing();
      return { solutionId: row.id, isFavorite: true };
    }),

  /**
   * FR-HUB-09: record an open (upsert openedAt). Called on viewer open (ticket
   * 12); exposed now so the hub star/row can be wired against it. Asserts see
   * (granted + unarchived + not draft) — recording a non-seeable solution is a
   * client error, never a silent insert.
   */
  recordRecent: protectedProcedure.input(recordRecentSchema).mutation(async ({ ctx, input }) => {
    const [row] = await db
      .select({
        id: solution.id,
        status: solution.status,
        archived: solution.archived,
      })
      .from(solution)
      .where(eq(solution.id, input.solutionId))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    await assertCanSee(ctx.auth.user, row);

    // Upsert openedAt; PK is (userId, solutionId) so one row per pair. The
    // recents list is capped at 6 by the read (ORDER BY opened_at DESC LIMIT 6),
    // so no pruning job is needed (tech-plan → data-model).
    await db
      .insert(recent)
      .values({ userId: ctx.auth.user.id, solutionId: row.id })
      .onConflictDoUpdate({
        target: [recent.userId, recent.solutionId],
        set: { openedAt: sql`now()` },
      });
    return { solutionId: row.id };
  }),

  /** FR-HUB-09: recents list (most-recent first, cap 6, access-gated). */
  recents: protectedProcedure.query(async ({ ctx }) => {
    return listRecentSolutions(ctx.auth.user);
  }),

  /** FR-HUB-09: favorites list (access-gated). */
  favorites: protectedProcedure.query(async ({ ctx }) => {
    return listFavoriteSolutions(ctx.auth.user);
  }),

  /**
   * Persist the rail's drag-reordered arrangement (design spec §5.3). Only
   * operates on the caller's own rows — no `canSee` re-check needed, since a
   * favorite the user can no longer see simply never renders (§5.1 gates the
   * read, not this write). Partition-reindex is race-tolerant: unknown ids
   * (e.g. unstarred in another tab) are dropped rather than erroring, and any
   * favorite absent from the payload (e.g. added elsewhere) is appended.
   */
  reorderFavorites: protectedProcedure
    .input(reorderFavoritesSchema)
    .mutation(async ({ ctx, input }) => {
      await db.transaction(async (tx) => {
        // Mirror listFavoriteSolutions's exact ordering (position ASC, then a
        // recency tiebreak) so `rest` preserves what the caller actually saw —
        // legacy rows all sit at position=0 (no data migration), so an
        // unordered/position-only tiebreak would let ties resolve to an
        // arbitrary DB order and silently reshuffle off-rail favorites the
        // user never touched.
        const current = await tx
          .select({
            solutionId: favorite.solutionId,
            position: favorite.position,
            lastOpenedAt: recent.openedAt,
            updatedAt: solution.updatedAt,
          })
          .from(favorite)
          .innerJoin(solution, eq(favorite.solutionId, solution.id))
          .leftJoin(
            recent,
            and(eq(recent.userId, ctx.auth.user.id), eq(recent.solutionId, favorite.solutionId)),
          )
          .where(eq(favorite.userId, ctx.auth.user.id));
        current.sort(
          (a, b) =>
            a.position - b.position ||
            (b.lastOpenedAt ?? b.updatedAt).getTime() - (a.lastOpenedAt ?? a.updatedAt).getTime(),
        );
        const currentIds = current.map((r) => r.solutionId);
        const final = resolveExplicitOrder(currentIds, input.orderedSolutionIds);

        // Single bulk UPDATE (via unnest) instead of one UPDATE per row: it's
        // one round trip regardless of favorite count, and — since it's one
        // atomic statement rather than N independent UPDATEs ordered by
        // client-supplied input — Postgres never has to interleave lock
        // acquisition across concurrent reorders the way per-row updates
        // would, so overlapping reorders from two tabs can't deadlock each
        // other on lock-order inversion.
        await tx.execute(sql`
          update ${favorite} as f
          set position = v.position
          from (
            select * from unnest(
              ${sql.param(final)}::uuid[],
              ${sql.param(final.map((_, index) => index))}::int[]
            ) as v(solution_id, position)
          ) as v
          where f.user_id = ${ctx.auth.user.id} and f.solution_id = v.solution_id
        `);
      });
      return { ok: true };
    }),
});
