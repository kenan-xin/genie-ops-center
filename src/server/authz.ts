import "server-only";

import { TRPCError } from "@trpc/server";
import { headers as nextHeaders } from "next/headers";

import { auth } from "@/server/auth";

/**
 * Authorization seam — the single place that decides what a session may do.
 *
 * Three surfaces (RSC, tRPC, `/api/chat`) all resolve a session through
 * {@link getServerAuth}, so the limited-session rules are enforced once, here,
 * not duplicated as page redirects:
 *   - `pending` users never reach here — better-auth's `session.create.before`
 *     hook (src/server/auth.ts) blocks their sign-in. Banned users are revoked
 *     by the admin plugin's own session handling.
 *   - `mustChangePassword` users DO hold a session, but getServerAuth returns
 *     `"password-change-required"` and every non-auth action is rejected until
 *     they change it (better-auth's reset-password endpoints are the escape hatch).
 *
 * `can()` / `assertAdmin` centralize role checks so a future ST-operator vs
 * customer-admin split is a permission-set change, not a refactor. Full
 * capability taxonomy is deferred — the foundation only needs "admin".
 */

export type Authenticated = {
  status: "authenticated";
  user: AuthUser;
  session: { id: string; userId: string; expiresAt: Date; token: string };
};

export type PasswordChangeRequired = {
  status: "password-change-required";
  user: AuthUser;
};

export type ServerAuth = Authenticated | PasswordChangeRequired | { status: "unauthenticated" };

/** The user fields our authorization cares about, with the derived FR status. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string; // multi-value: "user" | "user,admin"
  /** Derived tri-state (never dual-written): pending←status, disabled←banned, else active. */
  frStatus: "active" | "pending" | "disabled";
};

/**
 * Resolve the session shared by RSC, tRPC, and `/api/chat`. Pass `incoming`
 * headers from a request context; in RSC/route-handler scope it falls back to
 * `next/headers`. Enforces `mustChangePassword` here — the single point.
 */
export async function getServerAuth(incoming?: Headers): Promise<ServerAuth> {
  const h = incoming ?? (await nextHeaders());
  const session = await auth.api.getSession({ headers: h });
  if (!session) return { status: "unauthenticated" };

  const u = session.user;
  const user: AuthUser = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: (u.role as string) ?? "user",
    frStatus: deriveFrStatus(u),
  };

  if (u.mustChangePassword) {
    return { status: "password-change-required", user };
  }
  return {
    status: "authenticated",
    user,
    session: {
      id: session.session.id,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt,
      token: session.session.token,
    },
  };
}

/** FR tri-state derived from two independent fields, never dual-written.
 * Fails CLOSED on unknown/null status — only an explicit "active" counts; a
 * bad/garbage value is never implicitly active. */
function deriveFrStatus(u: {
  status?: string | null;
  banned?: boolean | null;
}): AuthUser["frStatus"] {
  if (u.banned) return "disabled";
  if (u.status === "active") return "active";
  return "pending"; // pending OR unknown/null — never implicitly active
}

/** Admins hold the `admin` value in the multi-value role string. */
export function isAdmin(user: Pick<AuthUser, "role">): boolean {
  return user.role
    .split(",")
    .map((r) => r.trim())
    .includes("admin");
}

export type Action = "admin";

/**
 * Central capability predicate. Foundation only models the admin capability;
 * `assertCanSee`/`assertCanRun` (solution-access) live in the solution service
 * since they need DB access facts. This seam exists so future capabilities are
 * added here, not inlined at call sites.
 */
export function can(user: Pick<AuthUser, "role">, action: Action): boolean {
  if (action === "admin") return isAdmin(user);
  return false;
}

export function assertAdmin(user: Pick<AuthUser, "role">): void {
  if (!isAdmin(user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
}

export { TRPCError };
