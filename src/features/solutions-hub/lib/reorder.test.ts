import { describe, expect, it } from "vitest";

import { resolveFavoriteReorder } from "./reorder";

describe("resolveFavoriteReorder", () => {
  it("reorders a leading subset while preserving the current order of the rest", () => {
    const current = ["a", "b", "c", "d", "e", "f", "g"];
    const requested = ["b", "a", "c"];
    expect(resolveFavoriteReorder(current, requested)).toEqual(["b", "a", "c", "d", "e", "f", "g"]);
  });

  it("drops unknown ids that are no longer in the current set", () => {
    const current = ["a", "b"];
    const requested = ["b", "z"];
    expect(resolveFavoriteReorder(current, requested)).toEqual(["b", "a"]);
  });

  it("returns currentIds unchanged when the requested order is empty", () => {
    const current = ["a", "b", "c"];
    expect(resolveFavoriteReorder(current, [])).toEqual(["a", "b", "c"]);
  });

  it("returns the exact requested order when all ids are provided", () => {
    const current = ["a", "b", "c"];
    const requested = ["c", "a", "b"];
    expect(resolveFavoriteReorder(current, requested)).toEqual(["c", "a", "b"]);
  });

  it("de-duplicates repeated ids in the requested order", () => {
    const current = ["a", "b", "c"];
    const requested = ["a", "a", "b"];
    expect(resolveFavoriteReorder(current, requested)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array when there are no current favorites", () => {
    expect(resolveFavoriteReorder([], ["a", "b"])).toEqual([]);
  });
});
