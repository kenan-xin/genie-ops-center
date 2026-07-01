import "server-only";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { assertStrongPassword } from "@/server/features/password";

/**
 * One domain service wrapping every better-auth admin mutation, so enforcement
 * (banned) and lifecycle (status) can't drift and raw admin calls aren't
 * scattered through UI procedures. UI procedures call these, never
 * `auth.api.<admin>` directly. (tech-plan → "Person lifecycle".)
 *
 * The admin server endpoints (everything except createUser) authenticate via the
 * caller's session cookie, so callers forward the request `headers`. Status is
 * derived (see authz.ts), never dual-written here; this service only manages the
 * underlying fields: `banned` (disable), `status` (invite), `role`.
 */

const ADMIN_ROLES: ("user" | "admin")[] = ["user", "admin"]; // "admin" added on top of "user"
const USER_ROLES: ("user" | "admin")[] = ["user"];

/** Invite a person: credential account + generated throwaway password, pending. */
export async function inviteUser(args: {
  email: string;
  name: string;
  headers: Headers;
  sendReset?: boolean;
}): Promise<{ id: string }> {
  // The throwaway password is never communicated; the user sets their own via the
  // reset link, which also flips pending→active (the onPasswordReset hook).
  const generatedPassword = crypto.randomUUID() + crypto.randomUUID();
  const created = await auth.api.createUser({
    body: {
      email: args.email,
      name: args.name,
      password: generatedPassword,
      role: USER_ROLES,
    },
    headers: args.headers,
  });
  // createUser defaults status via the additionalField default ("active"); an
  // invited user must be pending until they set their own password.
  await db.update(user).set({ status: "pending" }).where(eq(user.id, created.user.id));

  if (args.sendReset !== false) {
    // Point the invite link at /set-password (the activation landing) instead of
    // better-auth's default reset callback — otherwise /set-password has no caller.
    await auth.api.requestPasswordReset({
      body: {
        email: args.email,
        redirectTo: `${process.env.BETTER_AUTH_URL ?? ""}/set-password`,
      },
    });
  }
  return { id: created.user.id };
}

/** Disable a person (ban) — the only disabled-enforcement field. Revokes sessions. */
export async function disableUser(userId: string, headers: Headers): Promise<void> {
  await auth.api.banUser({ body: { userId }, headers });
}

/** Re-enable a person. */
export async function enableUser(userId: string, headers: Headers): Promise<void> {
  await auth.api.unbanUser({ body: { userId }, headers });
}

/** Grant admin capability (additive — stays a normal member too). */
export async function setAdmin(userId: string, headers: Headers): Promise<void> {
  await auth.api.setRole({ body: { userId, role: ADMIN_ROLES }, headers });
}

/** Remove admin capability. */
export async function clearAdmin(userId: string, headers: Headers): Promise<void> {
  await auth.api.setRole({ body: { userId, role: USER_ROLES }, headers });
}

/**
 * Set a user's password directly (admin-set) — the invite-token fallback if the
 * reset-link path ever can't activate an account. Requires an admin session.
 */
export async function adminSetPassword(
  userId: string,
  newPassword: string,
  headers: Headers,
): Promise<void> {
  assertStrongPassword(newPassword);
  await auth.api.setUserPassword({ body: { userId, newPassword }, headers });
  // better-auth's admin set-password writes via updateMany, which does NOT fire
  // the row-shaped `account.update.after` hook — so clear the force-change flag
  // here too, or an admin-reset user stays stuck in password-change-required.
  await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId));
}

/** Force a password change on next entry. (Direct DB write — not a better-auth concept.) */
export async function setMustChangePassword(userId: string, value: boolean): Promise<void> {
  await db.update(user).set({ mustChangePassword: value }).where(eq(user.id, userId));
}

/** Admin force-sign-out: revoke every session for a user. */
export async function revokeUserSessions(userId: string, headers: Headers): Promise<void> {
  await auth.api.revokeUserSessions({ body: { userId }, headers });
}

/** Idempotent guard for bootstrap callers. */
export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: user.id }).from(user).limit(1);
  return row ? 1 : 0; // ponytail: existence check, not a full count — only "any users?" matters for bootstrap
}

export { TRPCError };
