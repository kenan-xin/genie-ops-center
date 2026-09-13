import "server-only";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

import {
  assignCategorySchema,
  categoryIdSchema,
  createCategorySchema,
  renameCategorySchema,
  reorderCategoriesSchema,
} from "../schemas/category";
import * as categoryService from "./category-service";

/**
 * Category CRUD is admin-only. The one customer-facing procedure, `sidebar`,
 * is read-only and derives its visibility from the hub's access-gated query —
 * a category grants nothing on its own.
 */
export const categoriesRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    return categoryService.listCategories();
  }),

  /** Solution → category pairs for the admin screen's assignment control. */
  assignments: adminProcedure.query(async () => {
    return categoryService.listAssignments();
  }),

  create: adminProcedure.input(createCategorySchema).mutation(async ({ input }) => {
    return categoryService.createCategory(input.name);
  }),

  rename: adminProcedure.input(renameCategorySchema).mutation(async ({ input }) => {
    await categoryService.renameCategory(input.id, input.name);
    return { id: input.id };
  }),

  remove: adminProcedure.input(categoryIdSchema).mutation(async ({ input }) => {
    await categoryService.deleteCategory(input.id);
    return { id: input.id };
  }),

  reorder: adminProcedure.input(reorderCategoriesSchema).mutation(async ({ input }) => {
    await categoryService.reorderCategories(input.orderedIds);
    return { ok: true };
  }),

  assign: adminProcedure.input(assignCategorySchema).mutation(async ({ input }) => {
    await categoryService.assignCategory(input.solutionId, input.categoryId);
    return { solutionId: input.solutionId };
  }),

  /** The customer sidebar's categories and standalone solutions, in order. */
  sidebar: protectedProcedure.query(async ({ ctx }) => {
    return categoryService.listSidebarEntries(ctx.auth.user);
  }),
});
