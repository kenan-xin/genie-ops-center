import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPasswordResetEmail,
  getResendFromEmail,
  isResendConfigured,
  sendPasswordResetEmail,
} from "./mailer";

function env(overrides: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides } as NodeJS.ProcessEnv;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mailer", () => {
  it("detects when Resend is configured", () => {
    expect(isResendConfigured(env({ RESEND_API_KEY: "re_test" }))).toBe(true);
    expect(isResendConfigured(env({ RESEND_API_KEY: "   " }))).toBe(false);
    expect(isResendConfigured(env({}))).toBe(false);
  });

  it("defaults the sender to onboarding@resend.dev", () => {
    expect(getResendFromEmail(env({}))).toBe("onboarding@resend.dev");
    expect(getResendFromEmail(env({ RESEND_FROM_EMAIL: "team@example.com" }))).toBe(
      "team@example.com",
    );
  });

  it("builds a password email with the reset URL in both html and text", () => {
    const email = buildPasswordResetEmail({ url: "http://localhost:3000/set-password?token=test" });

    expect(email.subject).toContain("Genie Workspace");
    expect(email.html).toContain("http://localhost:3000/set-password?token=test");
    expect(email.text).toContain("http://localhost:3000/set-password?token=test");
  });

  it("posts invite/reset emails to Resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendPasswordResetEmail(
      { to: "person@example.com", url: "http://localhost:3000/reset?token=test" },
      env({ RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "onboarding@resend.dev" }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(input).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };
    expect(body.from).toBe("onboarding@resend.dev");
    expect(body.to).toEqual(["person@example.com"]);
    expect(body.subject).toContain("Genie Workspace");
    expect(body.text).toContain("http://localhost:3000/reset?token=test");
  });

  it("throws when Resend rejects the email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad request", { status: 400 })));

    await expect(
      sendPasswordResetEmail(
        { to: "person@example.com", url: "http://localhost:3000/reset?token=test" },
        env({ RESEND_API_KEY: "re_test" }),
      ),
    ).rejects.toThrow("Resend rejected invite/reset email");
  });
});
