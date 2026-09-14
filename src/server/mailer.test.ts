import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPasswordResetEmail,
  getResendFromEmail,
  isResendConfigured,
  sendPasswordResetEmail,
} from "./mailer";

// Shaped like the URL better-auth hands the delivery hook: the reset token path
// plus the service's redirectTo as ?callbackURL=.
function resetUrl(callbackPath: string): string {
  return `http://localhost:3000/api/auth/reset-password/tok_test?callbackURL=http://localhost:3000${callbackPath}`;
}

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

  it("builds a password email with the reset URL in both html and text", async () => {
    const url = resetUrl("/set-password");
    const email = await buildPasswordResetEmail({ url, variant: "invite" });

    expect(email.subject).toContain("Genie Ops Center");
    expect(email.html).toContain("Genie Ops Center");
    expect(email.text).toContain(url);
    // The URL's & is escaped in HTML but must stay raw in the text alternative.
    expect(email.html).toContain("reset-password/tok_test?callbackURL=");
  });

  it("gives the invite and reset messages distinct subject and body copy", async () => {
    const url = resetUrl("/set-password");
    const invite = await buildPasswordResetEmail({ url, variant: "invite" });
    const reset = await buildPasswordResetEmail({ url, variant: "reset" });

    expect(invite.subject).not.toBe(reset.subject);
    expect(invite.subject).toContain("Set your");
    expect(reset.subject).toContain("Reset your");
    expect(invite.text).toContain("An administrator added you");
    expect(reset.text).toContain("You asked to reset");
    expect(invite.html).toContain("Set password");
    expect(reset.html).toContain("Reset password");
  });

  it("posts invite/reset emails to Resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const url = resetUrl("/reset-password");
    await sendPasswordResetEmail(
      { to: "person@example.com", url, variant: "reset" },
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
      html: string;
      text: string;
    };
    expect(body.from).toBe("onboarding@resend.dev");
    expect(body.to).toEqual(["person@example.com"]);
    expect(body.subject).toBe("Reset your Genie Ops Center password");
    expect(body.text).toContain(url);
    expect(body.html).toContain("<html");
  });

  it("throws when Resend rejects the email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad request", { status: 400 })));

    await expect(
      sendPasswordResetEmail(
        {
          to: "person@example.com",
          url: "http://localhost:3000/reset?token=test",
          variant: "reset",
        },
        env({ RESEND_API_KEY: "re_test" }),
      ),
    ).rejects.toThrow("Resend rejected invite/reset email");
  });
});
