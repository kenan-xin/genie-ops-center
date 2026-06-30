import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";

import { assertAdmin, getServerAuth, type ServerAuth } from "@/server/authz";

/**
 * Shared request context. tRPC procedures consume the better-auth session via
 * {@link getServerAuth} — the same accessor RSC and `/api/chat` use — so the
 * limited-session rules (pending blocked, mustChangePassword enforced) apply
 * identically across all three surfaces. `cache` dedupes within an RSC pass.
 */
export const createTRPCContext = cache(async (opts?: { headers?: Headers }) => {
  const auth = await getServerAuth(opts?.headers);
  return { auth };
});

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

/**
 * Three tiers (tech-plan → "boundary is server-enforced"). The limited-session
 * enforcement happens in getServerAuth + these middlewares, not page redirects.
 */
export const publicProcedure = t.procedure.use(({ ctx, next }) => {
  // Public procedures see the session but don't require it (login, hub meta).
  return next({ ctx });
});

/** Requires an active, fully-authenticated session. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.auth.status === "unauthenticated") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  if (ctx.auth.status === "password-change-required") {
    // The escape hatch is better-auth's reset-password endpoint, not a tRPC call.
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "password-change-required",
    });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

/** Requires an admin session (role ∋ admin). */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const a = ctx.auth; // Authenticated (protectedProcedure guarantees it)
  assertAdmin(a.user);
  return next({ ctx: { ...ctx, auth: a } });
});

export type ServerAuthContext = ServerAuth;
