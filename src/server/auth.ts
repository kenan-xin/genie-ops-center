import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { passwordStrengthPlugin } from "@/server/features/password";
import * as schema from "@/server/db/schema";

const ONE_MINUTE = 60;
const FIFTEEN_MINUTES = 15 * ONE_MINUTE;

/**
 * better-auth — identity, credentials, sessions, password reset, admin actions.
 *
 * Domain authorization (groups → solutions) is layered on top in
 * `src/server/authz`. The admin plugin owns the multi-value `role` string
 * ("user" / "user,admin"); our custom `status`/`mustChangePassword` fields
 * carry the invite + force-change lifecycle only.
 *
 * Sessions are DB-backed (revocable, enumerable) with a true 15-min *idle*
 * timeout: `expiresIn: 15m` + `updateAge: 0` slides the expiry forward on every
 * authenticated request, and `cookieCache` is disabled so each request hits the
 * DB (refresh/revocation are exact). See tech-plan → "Sessions & lifecycle".
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification is off: clicking the reset link + setting a
    // password IS the invite verification. No separate email-verify step.
    requireEmailVerification: false,
    autoSignIn: false, // invitees sign in only after activating via set-password
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: ONE_MINUTE * 60, // invite link valid for 1h
    sendResetPassword: async ({ user: invitedUser, url }) => {
      // No email transport in foundation — surface the link via log. Ops/email
      // delivery is a later slice. (ponytail: log, not no-op, so the link is visible.)
      // eslint-disable-next-line no-console
      console.info(`[auth] password-reset link for ${invitedUser.email}: ${url}`);
    },
    onPasswordReset: async ({ user: u }) => {
      // Activation event for an admin-invited user: the moment they set their own
      // password, flip pending→active. Idempotent (whereStatus pending) so a later
      // change-password can't re-fire anything.
      await db
        .update(user)
        .set({ status: "active" })
        .where(and(eq(user.id, u.id), eq(user.status, "pending")));
    },
  },
  user: {
    additionalFields: {
      status: {
        type: "string",
        required: false,
        defaultValue: "active",
        input: false, // never client-settable; managed by the domain service
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: FIFTEEN_MINUTES,
    // 0 ⇒ refresh the expiry on every authenticated request → a true sliding
    // idle window (15 min since last activity), not an absolute timeout.
    updateAge: 0,
    cookieCache: {
      // Explicitly disabled. Each request resolves the session against the DB so
      // refresh/revocation/ban take effect immediately across all three surfaces
      // (RSC, tRPC, /api/chat).
      enabled: false,
    },
  },
  plugins: [
    passwordStrengthPlugin(),
    // Multi-value role string: "user" or "user,admin". adminRoles marks which
    // value grants admin capability. An admin is an elevated member, not a
    // separate account class.
    admin({ adminRoles: ["admin"], defaultRole: "user" }),
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Reject sign-in for un-activated invites. The set-password path flips
          // `status` pending→active (via onPasswordReset) BEFORE the user signs in,
          // so activated users pass this check normally — the carve-out is "by the
          // time you sign in, you're active", not a special path here.
          const [u] = await db
            .select({ status: user.status })
            .from(user)
            .where(eq(user.id, session.userId))
            .limit(1);
          // Returning false aborts session creation — blocks a pending invite's sign-in.
          return u?.status !== "pending";
        },
      },
    },
  },
});
