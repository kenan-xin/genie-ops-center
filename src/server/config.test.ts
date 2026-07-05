import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseConfig } from "./config";

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://genie:genie@localhost:5432/genie",
  BETTER_AUTH_SECRET: "x".repeat(32),
  PUBLIC_BASE_URL: "http://localhost:3000",
} satisfies NodeJS.ProcessEnv;

describe("parseConfig", () => {
  it("accepts Resend env vars when provided", () => {
    const parsed = parseConfig({
      ...baseEnv,
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "onboarding@resend.dev",
    });

    expect(parsed.RESEND_API_KEY).toBe("re_test");
    expect(parsed.RESEND_FROM_EMAIL).toBe("onboarding@resend.dev");
  });

  it("defaults the Resend sender for local testing", () => {
    const parsed = parseConfig(baseEnv);

    expect(parsed.RESEND_API_KEY).toBe("");
    expect(parsed.RESEND_FROM_EMAIL).toBe("onboarding@resend.dev");
  });
});
