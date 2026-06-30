import "server-only";

import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";

const PASSWORD_SETTING_PATHS = new Set([
  "/sign-up/email",
  "/change-password",
  "/set-password",
  "/reset-password",
  "/admin/create-user",
  "/admin/set-user-password",
]);

/**
 * Shared password-strength schema (UI meter + server use the same one).
 * Strength ≥3 of: length≥10, lowercase, uppercase, digit, symbol. No new dep —
 * plain zod refinements. (tech-plan → "Password reset / change".)
 */
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .refine(
    (pw) => strength(pw) >= 3,
    "Use a stronger password (3 of: length, lower, upper, digit, symbol)",
  );

/** 0–5 strength buckets; ≥3 is acceptable. */
export function strength(pw: string): number {
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

/** Throws on a weak password — used by bootstrap and any admin-set path. */
export function assertStrongPassword(pw: string): void {
  const parsed = passwordSchema.safeParse(pw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Weak password");
  }
}

/**
 * better-auth 1.6.23 exposes only min/max checks in reset/change/admin-set.
 * A before-hook validates the request body before those routes consume reset
 * tokens or hash the new credential.
 */
export function passwordStrengthPlugin(): BetterAuthPlugin {
  return {
    id: "genie-password-strength",
    hooks: {
      before: [
        {
          matcher: (ctx) => PASSWORD_SETTING_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const password = passwordFromBody(ctx.body);
            if (!password) {
              return;
            }

            const parsed = passwordSchema.safeParse(password);
            if (!parsed.success) {
              throw new APIError("BAD_REQUEST", {
                message: parsed.error.issues[0]?.message ?? "Weak password",
              });
            }
          }),
        },
      ],
    },
  };
}

function passwordFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const fields = body as { newPassword?: unknown; password?: unknown };
  if (typeof fields.newPassword === "string") {
    return fields.newPassword;
  }
  if (typeof fields.password === "string") {
    return fields.password;
  }
  return null;
}
