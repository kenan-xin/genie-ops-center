import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * better-auth browser client. Same-origin, so it defaults to `/api/auth`.
 *
 * Plugin mirror of the server (src/server/auth.ts): `adminClient` types the
 * multi-value `role` string, `inferAdditionalFields` types our lifecycle fields
 * (`status`, `mustChangePassword`) — declared by runtime schema here so this
 * stays client-safe (no `server-only` import pulled into the bundle).
 */
export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    inferAdditionalFields({
      user: {
        status: { type: "string" },
        mustChangePassword: { type: "boolean" },
      },
    }),
  ],
});

/** Client mirror of server `isAdmin`: admin capability lives in the role string. */
export function isAdminRole(role?: string | null): boolean {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes("admin");
}
