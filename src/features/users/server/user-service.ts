import "server-only";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { assertStrongPassword } from "@/server/features/password";
import { isResendConfigured } from "@/server/mailer";

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

/**
 * Mailer guard. In production, reset/invite links can only be delivered by a
 * real delivery adapter — better-auth's `sendResetPassword` hook is fire-and-
 * forget (its rejection is swallowed by `runInBackgroundOrAwait`, which only
 * logs), so guarding there can't fail the request. Callers that *initiate* a
 * reset/invite must call this BEFORE creating a user / token, so the request
 * fails loudly (no pending user, no undeliverable bearer token). Dev/test skip
 * it — the hook logs the link there.
 */
function requireMailerConfigured(action: "invite" | "reset"): void {
  if (process.env.NODE_ENV === "production" && !isResendConfigured()) {
    throw new Error(
      `${action} requires Resend in production — set RESEND_API_KEY (and optionally RESEND_FROM_EMAIL). Refusing to create an undeliverable ${action} link.`,
    );
  }
}

/**
 * Email better-auth's reset-token link. `variant` only changes the landing
 * page copy (both consume the same token via `authClient.resetPassword`):
 * `activate` → `/set-password` (invite-activation copy, also flips
 * pending→active via the `onPasswordReset` hook); `reset` → `/reset-password`
 * (generic reset copy) for an already-active person.
 */
export async function sendPasswordReset(
  email: string,
  variant: "activate" | "reset" = "reset",
): Promise<void> {
  requireMailerConfigured("reset");
  const path = variant === "activate" ? "/set-password" : "/reset-password";
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: `${process.env.PUBLIC_BASE_URL ?? ""}${path}` },
  });
}

/** Invite a person: credential account + generated throwaway password, pending. */
export async function inviteUser(args: {
  email: string;
  name: string;
  headers: Headers;
  role?: "user" | "admin";
  sendReset?: boolean;
}): Promise<{ id: string }> {
  // Fail BEFORE creating anything: better-auth's delivery hook can't surface a
  // failure (see requireMailerConfigured), so an undeliverable invite would
  // otherwise leave a pending user with no activation path.
  requireMailerConfigured("invite");

  // The throwaway password is never communicated; the user sets their own via the
  // reset link, which also flips pending→active (the onPasswordReset hook).
  const generatedPassword = crypto.randomUUID() + crypto.randomUUID();
  const created = await auth.api.createUser({
    body: {
      email: args.email,
      name: args.name,
      password: generatedPassword,
      role: args.role === "admin" ? ADMIN_ROLES : USER_ROLES,
    },
    headers: args.headers,
  });
  // createUser defaults status via the additionalField default ("active"); an
  // invited user must be pending until they set their own password.
  await db.update(user).set({ status: "pending" }).where(eq(user.id, created.user.id));

  if (args.sendReset !== false) {
    await sendPasswordReset(args.email, "activate");
  }
  return { id: created.user.id };
}

/** Update a person's editable profile fields — never password/role/banned (those have their own calls). */
export async function updateUserProfile(
  userId: string,
  data: { name?: string; email?: string },
  headers: Headers,
): Promise<void> {
  await auth.api.adminUpdateUser({ body: { userId, data }, headers });
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
 * reset-link path ever can't activate an account, and the `requireChange: false`
 * branch of {@link adminSetTempPassword}. Requires an admin session.
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

/**
 * Admin-generated temporary password (FR-ADM-P-05). By default
 * (`requireChange: true`, the historical behavior) the person must change it
 * on next sign-in, and the fixed prefix guarantees every strength class
 * (upper/lower/digit/symbol) regardless of the random suffix, so it always
 * clears the shared password schema. `requireChange: false` still generates
 * and sets a temp password but clears `mustChangePassword` instead, by
 * delegating to {@link adminSetPassword} — for an admin who wants to hand the
 * person a working password without forcing an extra change step. `activate:
 * true` additionally flips a still-pending person straight to `active`
 * (FR-ADM-P-04's "activate" action — for when the reset-link email isn't a
 * viable channel), since a raw admin password write doesn't go through the
 * reset flow that normally does this; the `activate` procedure never passes
 * `requireChange`, so it keeps defaulting to `true` (a newly activated person
 * must still set their own password). The plaintext is returned once for the
 * admin to hand off out of band; it is never logged or stored.
 */
export async function adminSetTempPassword(
  userId: string,
  headers: Headers,
  opts?: { activate?: boolean; requireChange?: boolean },
): Promise<{ tempPassword: string }> {
  const requireChange = opts?.requireChange ?? true;
  const tempPassword = `Tmp1!${crypto.randomUUID().replace(/-/g, "")}`;
  if (requireChange) {
    await auth.api.setUserPassword({ body: { userId, newPassword: tempPassword }, headers });
    await db
      .update(user)
      .set({ mustChangePassword: true, ...(opts?.activate ? { status: "active" as const } : {}) })
      .where(eq(user.id, userId));
  } else {
    await adminSetPassword(userId, tempPassword, headers);
    if (opts?.activate) {
      await db
        .update(user)
        .set({ status: "active" as const })
        .where(eq(user.id, userId));
    }
  }
  return { tempPassword };
}

/** Force a password change on next entry. (Direct DB write — not a better-auth concept.) */
export async function setMustChangePassword(userId: string, value: boolean): Promise<void> {
  await db.update(user).set({ mustChangePassword: value }).where(eq(user.id, userId));
}

/** Admin force-sign-out: revoke every session for a user. */
export async function revokeUserSessions(userId: string, headers: Headers): Promise<void> {
  await auth.api.revokeUserSessions({ body: { userId }, headers });
}

/** Remove a person (FR-ADM-P-06). `group_member` rows cascade via the FK. */
export async function removeUser(userId: string, headers: Headers): Promise<void> {
  await auth.api.removeUser({ body: { userId }, headers });
}

/** Idempotent guard for bootstrap callers. */
export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: user.id }).from(user).limit(1);
  return row ? 1 : 0; // ponytail: existence check, not a full count — only "any users?" matters for bootstrap
}

export { TRPCError };
