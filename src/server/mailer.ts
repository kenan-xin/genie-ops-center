import "server-only";

import type { PasswordEmailVariant } from "@/server/emails/password-email";

export type { PasswordEmailVariant };

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_RESEND_FROM_EMAIL = "onboarding@resend.dev";

type PasswordResetEmailArgs = {
  to: string;
  url: string;
  variant: PasswordEmailVariant;
};

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

export async function buildPasswordResetEmail({
  url,
  variant,
}: {
  url: string;
  variant: PasswordEmailVariant;
}): Promise<{ subject: string; html: string; text: string }> {
  // Loaded on demand, never at module scope. `@react-email/render` reaches
  // `react-dom/server`, which resolves to a file that only throws under the
  // `react-server` condition that `build:entrypoint` and `reset-admin` bundle
  // with. Those two bundles reach this module through `@/server/auth` but never
  // send email, so the import is never evaluated there.
  const { renderPasswordEmail } = await import("@/server/emails/password-email");
  return renderPasswordEmail({ url, variant });
}

export async function sendPasswordResetEmail(
  { to, url, variant }: PasswordResetEmailArgs,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const apiKey = getResendApiKey(env);
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send invite/reset emails via Resend.");
  }

  const email = await buildPasswordResetEmail({ url, variant });
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
