import { describe, expect, it } from "vitest";

import { embeddedConfigSchema } from "./solution";

describe("embeddedConfigSchema", () => {
  it("accepts a public HTTPS app without an origin allow-list", () => {
    expect(
      embeddedConfigSchema.safeParse({ iframeUrl: "https://loan-review-app.vercel.app/" }).success,
    ).toBe(true);
  });

  it.each(["http://example.com", "https://localhost:3000", "data:text/html,hello"])(
    "rejects non-public HTTPS URL %s",
    (iframeUrl) => {
      expect(embeddedConfigSchema.safeParse({ iframeUrl }).success).toBe(false);
    },
  );
});
