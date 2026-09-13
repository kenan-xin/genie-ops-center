import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware";

describe("middleware", () => {
  it("permits HTTPS iframe sources without deployment configuration", () => {
    const response = middleware(new NextRequest("https://ops.example.test/admin/solutions"));

    expect(response.headers.get("Content-Security-Policy")).toBe("frame-src 'self' https:");
  });
});
