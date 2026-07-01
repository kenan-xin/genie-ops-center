import "server-only";

import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { passwordSchema, strength } from "@/lib/password-strength";

// The strength rule itself lives in a client-safe module so the UI meter and
// the server enforce the exact same rule. Re-exported here to keep the existing
// `@/server/features/password` import surface (auth plugin, bootstrap, etc.).
export { passwordSchema, strength };

const PASSWORD_SETTING_PATHS = new Set([
  "/sign-up/email",
  "/change-password",
  "/set-password",
  "/reset-password",
  "/admin/create-user",
  "/admin/set-user-password",
]);

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
