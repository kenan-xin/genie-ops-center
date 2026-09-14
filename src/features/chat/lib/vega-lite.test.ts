import { describe, expect, it } from "vitest";

import { parseInlineVegaLiteSpec } from "./vega-lite";

describe("parseInlineVegaLiteSpec", () => {
  it("accepts an inline Vega-Lite chart", () => {
    const spec = parseInlineVegaLiteSpec(
      JSON.stringify({
        $schema: "https://vega.github.io/schema/vega-lite/v6.json",
        data: { values: [{ month: "Jan", sales: 12 }] },
        mark: "line",
        encoding: {
          x: { field: "month", type: "ordinal" },
          y: { field: "sales", type: "quantitative" },
        },
      }),
    );

    expect(spec.mark).toBe("line");
  });

  it("rejects external data and image URLs", () => {
    expect(() =>
      parseInlineVegaLiteSpec(
        JSON.stringify({
          data: { url: "https://example.com/private.csv" },
          mark: "line",
        }),
      ),
    ).toThrow("External URLs");

    expect(() =>
      parseInlineVegaLiteSpec(
        JSON.stringify({
          data: { values: [{ image: "https://example.com/tracker.png" }] },
          mark: { type: "image" },
          encoding: { url: { field: "image" } },
        }),
      ),
    ).toThrow("External URLs");
  });

  it("rejects non-object specifications", () => {
    expect(() => parseInlineVegaLiteSpec("[]")).toThrow("JSON object");
  });

  it("rejects prototype-polluting properties", () => {
    expect(() => parseInlineVegaLiteSpec('{"__proto__":{"polluted":true}}')).toThrow(
      "Unsupported Vega-Lite property",
    );
  });
});
