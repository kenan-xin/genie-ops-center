import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_RESEND_FROM_EMAIL = "onboarding@resend.dev";

type PasswordResetEmailArgs = {
  to: string;
  url: string;
};

type PasswordResetEmailContentArgs = Pick<PasswordResetEmailArgs, "url">;

function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getResendApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return readEnv(env.RESEND_API_KEY);
}

export function isResendConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!getResendApiKey(env);
}

export function getResendFromEmail(env: NodeJS.ProcessEnv = process.env): string {
  return readEnv(env.RESEND_FROM_EMAIL) ?? DEFAULT_RESEND_FROM_EMAIL;
}

export function buildPasswordResetEmail({ url }: PasswordResetEmailContentArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Set or reset your Genie Workspace password";
  const intro =
    "Use the secure link below to set a new password and continue into Genie Workspace.";
  return {
    subject,
    html: [
      `<p>${intro}</p>`,
      `<p><a href="${url}">Set your password</a></p>`,
      `<p>If the button does not work, copy and paste this link into your browser:</p>`,
      `<p><a href="${url}">${url}</a></p>`,
      `<p>If you did not expect this email, you can safely ignore it.</p>`,
    ].join(""),
    text: `${intro}\n\n${url}\n\nIf you did not expect this email, you can safely ignore it.`,
  };
}

export async function sendPasswordResetEmail(
  { to, url }: PasswordResetEmailArgs,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const apiKey = getResendApiKey(env);
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send invite/reset emails via Resend.");
  }

  const email = buildPasswordResetEmail({ url });
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getResendFromEmail(env),
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Resend rejected invite/reset email (${response.status} ${response.statusText}): ${detail.slice(0, 300)}`,
    );
  }
}
