import { z } from "zod";

/**
 * Hub catalogue filters (FR-HUB-02/03/04). `native` is never an option here —
 * it's hidden from the catalogue (enum-only, deferred runtime), so the type
 * filter exposes All / Chat / Embedded only.
 */
export const hubTypeFilterSchema = z.enum(["all", "chat", "embedded"]);
export type HubTypeFilter = z.infer<typeof hubTypeFilterSchema>;

export const hubSortSchema = z.enum(["recent", "name", "status"]);
export type HubSort = z.infer<typeof hubSortSchema>;

export const listHubSchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: hubTypeFilterSchema.optional(),
  sort: hubSortSchema.default("recent"),
});
export type ListHubInput = z.infer<typeof listHubSchema>;

export const toggleFavoriteSchema = z.object({ solutionId: z.uuid() });
export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteSchema>;

export const recordRecentSchema = z.object({ solutionId: z.uuid() });
export type RecordRecentInput = z.infer<typeof recordRecentSchema>;

/** PINNED rail drag-reorder payload — the (≤6) visible ids in their new order. */
export const reorderFavoritesSchema = z.object({
  orderedSolutionIds: z
    .array(z.uuid())
    .min(1)
    .max(50)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "orderedSolutionIds must not contain duplicates",
    ),
});
export type ReorderFavoritesInput = z.infer<typeof reorderFavoritesSchema>;
