import { describe, expect, it } from "vitest";

import { embedSandboxAllowSameOrigin } from "./embed-sandbox";

describe("embedSandboxAllowSameOrigin", () => {
  it("grants the origin back for cross-origin embeds", () => {
    expect(
      embedSandboxAllowSameOrigin(
        "https://history-taking.agilgenie.ai",
        "https://opscenter-dev.agilgenie.ai",
      ),
    ).toBe(true);
  });

  it("keeps the strict sandbox for same-origin embeds", () => {
    expect(
      embedSandboxAllowSameOrigin(
        "https://opscenter-dev.agilgenie.ai/s/history-taking",
        "https://opscenter-dev.agilgenie.ai",
      ),
    ).toBe(false);
  });

  it("normalizes ports when comparing origins", () => {
    expect(
      embedSandboxAllowSameOrigin(
        "https://opscenter-dev.agilgenie.ai:443/s/x",
        "https://opscenter-dev.agilgenie.ai",
      ),
    ).toBe(false);
    expect(embedSandboxAllowSameOrigin("http://localhost:3000/s/x", "http://localhost:3001")).toBe(
      true,
    );
  });

  it("fails closed on malformed or missing input", () => {
    expect(embedSandboxAllowSameOrigin("not a url", "https://ops.dev")).toBe(false);
    expect(embedSandboxAllowSameOrigin("https://history-taking.agilgenie.ai", "")).toBe(false);
    expect(embedSandboxAllowSameOrigin("https://history-taking.agilgenie.ai", "junk")).toBe(false);
  });
});
