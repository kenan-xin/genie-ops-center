import { describe, expect, it } from "vitest";

import { parseCollapsed, serialiseCollapsed } from "./use-collapsed-categories";

describe("collapsed category storage", () => {
  it("returns an empty set when nothing is stored", () => {
    expect(parseCollapsed(null)).toEqual(new Set());
  });

  it("returns an empty set for malformed JSON instead of throwing", () => {
    expect(parseCollapsed("{oops")).toEqual(new Set());
  });

  it("returns an empty set when the stored value is not an array of strings", () => {
    expect(parseCollapsed('{"a":1}')).toEqual(new Set());
    expect(parseCollapsed("[1,2]")).toEqual(new Set());
  });

  it("round-trips a set of ids", () => {
    const ids = new Set(["cat-1", "cat-2"]);
    expect(parseCollapsed(serialiseCollapsed(ids))).toEqual(ids);
  });
});
