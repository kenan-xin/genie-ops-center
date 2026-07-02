import "server-only";

import { TRPCError } from "@trpc/server";
import { and, eq, exists } from "drizzle-orm";

import { db } from "@/server/db";
import { groupMember, groupSolution, solution } from "@/server/db/schema";
import type { AuthUser } from "@/server/authz";

/**
 * Solution access = membership ∩ grant, minus archived (and minus draft for
 * customers). This query backs the hub list and the see/run guards. A user's
 * reachable solutions = solutions granted to their groups.
 *
 * see vs run (tech-plan): `assertCanSee` allows rendering the viewer shell +
 * a maintenance/down notice (granted, not archived, not draft). `assertCanRun`
 * adds `status = ready` — gates `/api/chat` streaming and live embeds.
 * Recents/Favorites reuse the same predicate so a revoked/archived/drafted
 * solution drops from those lists immediately.
 */

/** The columns a "see"/list query wants (no config — that's runtime-only). */
export const SOLUTION_VIEW_COLUMNS = {
  id: solution.id,
  name: solution.name,
  slug: solution.slug,
  type: solution.type,
  status: solution.status,
  description: solution.description,
  monogram: solution.monogram,
  archived: solution.archived,
  themeId: solution.themeId,
} as const;

export type SolutionView = {
  id: string;
  name: string;
  slug: string;
  type: "chat" | "native" | "embedded";
  status: "ready" | "draft" | "maintenance" | "down";
  description: string | null;
  monogram: string | null;
  archived: boolean;
  themeId: string | null;
};

/** True iff `userId` is granted `solutionId` through any of their groups. */
export async function isGrantedSolution(userId: string, solutionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: groupSolution.solutionId })
    .from(groupSolution)
    .where(
      and(
        eq(groupSolution.solutionId, solutionId),
        exists(
          db
            .select()
            .from(groupMember)
            .where(
              and(eq(groupMember.groupId, groupSolution.groupId), eq(groupMember.userId, userId)),
            ),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Granted + not archived + not draft — the "customer can open" predicate.
 *
 * `native` is intentionally NOT excluded here (Phase-3 review): native is still
 * *see-able* — the viewer renders a "not openable" notice for it — so excluding
 * it from `canSee` would turn that into a 404. Native's exclusion is a *catalogue*
 * concern and lives in the hub list query (`solutions-hub/server/queries.ts`),
 * not this access gate. (And native is never granted, so it can't reach recents/
 * favorites anyway.)
 */
export async function canSee(
  user: AuthUser,
  s: { status: SolutionView["status"]; archived: boolean; id: string },
): Promise<boolean> {
  if (s.archived) return false;
  if (s.status === "draft") return false; // draft is never openable, by anyone
  return isGrantedSolution(user.id, s.id);
}

/** see AND status = ready — gates live running (chat streaming, embeds). */
export async function canRun(
  user: AuthUser,
  s: { status: SolutionView["status"]; archived: boolean; id: string },
): Promise<boolean> {
  return (await canSee(user, s)) && s.status === "ready";
}

export async function assertCanSee(
  user: AuthUser,
  s: { status: SolutionView["status"]; archived: boolean; id: string },
): Promise<void> {
  if (s.archived) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Solution not available" });
  }
  if (s.status === "draft") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Solution not available" });
  }
  if (!(await isGrantedSolution(user.id, s.id))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this solution" });
  }
}

export async function assertCanRun(
  user: AuthUser,
  s: { status: SolutionView["status"]; archived: boolean; id: string },
): Promise<void> {
  await assertCanSee(user, s);
  if (s.status !== "ready") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Solution is ${s.status}, not runnable`,
    });
  }
}
