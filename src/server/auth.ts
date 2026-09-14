import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { authTrustedProxies } from "@/server/config";
import { user } from "@/server/db/schema";
import {
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  passwordStrengthPlugin,
} from "@/server/features/password";
import { isResendConfigured, sendPasswordResetEmail } from "@/server/mailer";
import * as schema from "@/server/db/schema";

const ONE_MINUTE = 60;
const FIFTEEN_MINUTES = 15 * ONE_MINUTE;
const LIMITED_SESSION_PATHS = new Set([
  "/get-session",
  "/sign-in/email",
  "/sign-out",
  "/change-password",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
]);

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
  baseURL: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: {
    ipAddress: { trustedProxies: authTrustedProxies() },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (LIMITED_SESSION_PATHS.has(ctx.path) && ctx.path !== "/change-password") return;

      // Resolve through Better Auth directly; calling auth.api.getSession here
      // would re-enter our hooks. Endpoints retain their own anonymous guards.
      const session = await getSessionFromCtx(ctx);
      if (
        session?.user &&
        "mustChangePassword" in session.user &&
        session.user.mustChangePassword
      ) {
        if (ctx.path === "/change-password") {
          // A second login with the temporary password must not become usable
          // when this user finishes recovery. Enforce this even for raw callers.
          return {
            context: {
              ...ctx,
              body: { ...ctx.body, revokeOtherSessions: true },
            },
          };
        }
        throw new APIError("FORBIDDEN", {
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Change your password before continuing.",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const result = ctx.context.returned;
      if (
        ctx.path === "/admin/set-user-password" &&
        result &&
        typeof result === "object" &&
        "status" in result &&
        result.status === true
      ) {
        // Cover service calls and the directly exposed admin endpoint. Only a
        // successful reset may revoke sessions; the acting admin is unaffected
        // unless resetting their own password.
        await ctx.context.internalAdapter.deleteUserSessions(ctx.body.userId);
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    // requireEmailVerification is off: clicking the reset link + setting a
    // password IS the invite verification. No separate email-verify step.
    requireEmailVerification: false,
    autoSignIn: false, // invitees sign in only after activating via set-password
    revokeSessionsOnPasswordReset: true,
    // Stated to the recipient in the invite/reset email (PASSWORD_RESET_TOKEN_TTL_LABEL).
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_TTL_SECONDS,
    sendResetPassword: async ({ user: invitedUser, url }) => {
      // Delivery hook. Better Auth runs this via runInBackgroundOrAwait, which
      // swallows rejections (logs only) — so throwing here CANNOT fail the
      // request. Production fail-closed enforcement therefore lives at the
      // callers (see requireMailerConfigured in features/users/server/user-service.ts), which guard
      // BEFORE a token/user is created. If Resend is configured, use it in any
      // environment; otherwise never log the bearer URL in prod, but keep the
      // dev/test console fallback so the flow stays usable without a mailer.
      if (isResendConfigured()) {
        await sendPasswordResetEmail({ to: invitedUser.email, url });
        return;
      }

      if (process.env.NODE_ENV === "production") {
        return;
      }

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
      // The reset path updates the credential WITHOUT firing the account.update
      // hook (verified), so clear any force-change here too — a forced-change user
      // who resets via the link mustn't stay stuck in password-change-required.
      await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, u.id));
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
    // 0 ⇒ disable better-auth's freshness gate. `freshAge` measures now−createdAt
    // (time since *login*) and is a step-up ("sudo mode") trigger for long-lived
    // sessions paired with a re-auth flow — we have neither. Our sessions slide
    // on activity so createdAt legitimately ages past the default 24h while the
    // user stays active, which would (wrongly) break listSessions (the devices
    // list — the only used, freshness-gated endpoint here). updateUser/rename is
    // NOT gated. Sensitive actions here re-auth explicitly instead
    // (change-password needs currentPassword; a future delete would pass a
    // password, which bypasses freshness anyway). See
    // docs/tech-plan/account-sessions.
    freshAge: 0,
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
    account: {
      update: {
        // The credential password lives in the account table, so any legitimate
        // password write (change / reset / set-password / admin-set) updates this
        // row. That's the single point where a forced change is satisfied, so we
        // clear `mustChangePassword` here — the force-change loop always
        // terminates, whichever path set the new password. Idempotent.
        after: async (account) => {
          if (account.userId) {
            await db
              .update(user)
              .set({ mustChangePassword: false })
              .where(eq(user.id, account.userId));
          }
        },
      },
    },
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
          // Returning false aborts session creation. Fail CLOSED on unknown/null
          // status (treat anything that isn't explicitly "active" as not-yet-
          // usable) so a bad value can never become a live session. Pending
          // invites are blocked here; active users pass.
          return u?.status === "active";
        },
      },
    },
  },
});
