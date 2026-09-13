import { describe, expect, it } from "vitest";

import { assignCategorySchema, createCategorySchema, reorderCategoriesSchema } from "./category";

const uuidA = "9f1a7c10-0000-4000-8000-000000000001";
const uuidB = "9f1a7c10-0000-4000-8000-000000000002";

describe("category schemas", () => {
  it("trims a category name", () => {
    expect(createCategorySchema.parse({ name: "  Financial " })).toEqual({ name: "Financial" });
  });

  it("rejects an empty category name", () => {
    expect(createCategorySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 80 characters", () => {
    expect(createCategorySchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });

  it("accepts null as the category id when a solution stands alone", () => {
    expect(assignCategorySchema.parse({ solutionId: uuidA, categoryId: null })).toEqual({
      solutionId: uuidA,
      categoryId: null,
    });
  });

  it("rejects duplicate ids in a reorder payload", () => {
    expect(reorderCategoriesSchema.safeParse({ orderedIds: [uuidA, uuidA] }).success).toBe(false);
    expect(reorderCategoriesSchema.safeParse({ orderedIds: [uuidA, uuidB] }).success).toBe(true);
  });
});
