import "server-only";

import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { category, solutionCategory } from "@/server/db/schema";
import type { AuthUser } from "@/server/authz";
import { resolveExplicitOrder } from "@/features/solutions-hub/lib/reorder";
import { listHubSolutions } from "@/features/solutions-hub/server/queries";

import { buildSidebarEntries } from "../lib/sidebar-entries";
import type { CategorySummary, SidebarEntry } from "../schemas/category";

/**
 * Category reads and writes. A category is presentation only: nothing here
 * touches `group_solution`, and the sidebar read below derives visibility from
 * the hub's existing access-gated query rather than from any category rule.
 */

export async function listCategories(): Promise<CategorySummary[]> {
  return db
    .select({
      id: category.id,
      name: category.name,
      position: category.position,
      solutionCount: sql<number>`count(${solutionCategory.solutionId})::int`,
    })
    .from(category)
    .leftJoin(solutionCategory, eq(solutionCategory.categoryId, category.id))
    .groupBy(category.id)
    .orderBy(asc(category.position), asc(category.name));
}

export async function createCategory(name: string): Promise<{ id: string }> {
  // Append: a new category lands last in the admin's order.
  const [row] = await db
    .insert(category)
    .values({
      name,
      position: sql<number>`coalesce((select max(${category.position}) from ${category}), -1) + 1`,
    })
    .returning({ id: category.id });
  return { id: row!.id };
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await db.update(category).set({ name, updatedAt: new Date() }).where(eq(category.id, id));
}

/**
 * Deleting a category cascades its `solution_category` rows, so its solutions
 * become standalone. A delete never removes a solution from the sidebar.
 */
export async function deleteCategory(id: string): Promise<void> {
  await db.delete(category).where(eq(category.id, id));
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: category.id })
      .from(category)
      .orderBy(asc(category.position), asc(category.name));
    const final = resolveExplicitOrder(
      current.map((c) => c.id),
      orderedIds,
    );
    if (final.length === 0) return;
    // One bulk UPDATE via unnest — the same shape as reorderFavorites, so two
    // concurrent reorders cannot deadlock on lock-order inversion.
    await tx.execute(sql`
      update ${category} as c
      set position = v.position
      from (
        select * from unnest(
          ${sql.param(final)}::uuid[],
          ${sql.param(final.map((_, index) => index))}::int[]
        ) as v(id, position)
      ) as v
      where c.id = v.id
    `);
  });
}

/**
 * One category per solution: the write is an upsert keyed on the solution id,
 * which the primary key enforces. `null` clears the row and returns the
 * solution to the standalone section.
 */
export async function assignCategory(solutionId: string, categoryId: string | null): Promise<void> {
  if (categoryId === null) {
    await db.delete(solutionCategory).where(eq(solutionCategory.solutionId, solutionId));
    return;
  }
  // Check the category first. Without this, assigning to a category another
  // admin just deleted raises a Postgres foreign-key violation (23503), which
  // reaches the admin screen as an opaque 500 instead of a clear message.
  const [target] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, categoryId))
    .limit(1);
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
  }
  await db
    .insert(solutionCategory)
    .values({ solutionId, categoryId })
    .onConflictDoUpdate({ target: solutionCategory.solutionId, set: { categoryId } });
}

/**
 * The customer sidebar. `listHubSolutions` already applies the access gate
 * (membership ∩ grant, minus archived, draft, and native), so this function
 * adds grouping only. It never widens or narrows what the user can reach.
 */
export async function listSidebarEntries(user: AuthUser): Promise<SidebarEntry[]> {
  const [solutions, categories, assignments] = await Promise.all([
    listHubSolutions(user, { sort: "name" }),
    db.select({ id: category.id, name: category.name, position: category.position }).from(category),
    db
      .select({
        solutionId: solutionCategory.solutionId,
        categoryId: solutionCategory.categoryId,
      })
      .from(solutionCategory),
  ]);
  return buildSidebarEntries(
    categories,
    solutions,
    new Map(assignments.map((a) => [a.solutionId, a.categoryId])),
  );
}
