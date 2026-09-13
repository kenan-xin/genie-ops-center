import { z } from "zod";

import type { HubSolution } from "@/features/solutions-hub/server/queries";

/**
 * Shared schemas for the admin category taxonomy. Client-safe (no
 * `server-only`): the same schemas back the tRPC router and the admin form.
 *
 * A category is presentation only. It carries no access rule — see the design
 * spec, "Visibility".
 */

const nameSchema = z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters");

export const createCategorySchema = z.object({ name: nameSchema });
export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const categoryIdSchema = z.object({ id: z.uuid() });

export const renameCategorySchema = z.object({ id: z.uuid(), name: nameSchema });
export type RenameCategoryValues = z.infer<typeof renameCategorySchema>;

/** Whole-set order write: every category id in the admin's new order. */
export const reorderCategoriesSchema = z.object({
  orderedIds: z
    .array(z.uuid())
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, "orderedIds must not contain duplicates"),
});
export type ReorderCategoriesValues = z.infer<typeof reorderCategoriesSchema>;

/** `categoryId: null` means "this solution stands alone" — a deliberate choice. */
export const assignCategorySchema = z.object({
  solutionId: z.uuid(),
  categoryId: z.uuid().nullable(),
});
export type AssignCategoryValues = z.infer<typeof assignCategorySchema>;

/** An admin directory row — the `categories.list` output shape. */
export type CategorySummary = {
  id: string;
  name: string;
  position: number;
  solutionCount: number;
};

/** A category with the solutions this user can reach inside it. */
export type SidebarCategory = {
  id: string;
  name: string;
  solutions: HubSolution[];
};

/**
 * One row of the sidebar below the PINNED rail. Categories come first in admin
 * order, then the standalone solutions.
 */
export type SidebarEntry =
  | { kind: "category"; category: SidebarCategory }
  | { kind: "solution"; solution: HubSolution };
