/**
 * Smoke check for ticket 03 identity invariants. Run against a migrated DB:
 *   DATABASE_URL=... pnpm tsx scripts/smoke-identity.ts
 *
 * Proves the identity invariants:
 *  1. bootstrap seeds one user,admin (mustChangePassword set) only when user table empty
 *  2. weak passwords are rejected, including reset-link activation
 *  3. pending is blocked at session.create.before
 *  4. mustChangePassword is enforced at the shared accessor (getServerAuth)
 *  5. idle config (expiresIn/updateAge/cookieCache) is what we expect
 *  6. clearing mustChangePassword restores normal authenticated access
 *  7. public signup is rejected without creating users or sessions
 * Not a test framework — one file, asserts, exits non-zero on the first failure.
 */
import { bootstrapAdmin } from "@/server/bootstrap";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { session, user, verification } from "@/server/db/schema";
import { getServerAuth } from "@/server/authz";
import { eq } from "drizzle-orm";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.info(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

async function main() {
  console.info("\n[1] bootstrap — idempotent, seeds admin, sets mustChangePassword");
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.ADMIN_PASSWORD = "Sup3rSecret!pw";

  await bootstrapAdmin();
  let [admin] = await db.select().from(user).where(eq(user.email, "admin@example.com")).limit(1);
  check("seeded exactly one admin", !!admin);
  check('role is "user,admin"', admin?.role === "user,admin", `got ${admin?.role}`);
  check("mustChangePassword set", admin?.mustChangePassword === true);
  check("status active", admin?.status === "active", `got ${admin?.status}`);

  // Idempotent: second run is a no-op (user table no longer empty).
  await bootstrapAdmin();
  const count = (await db.select({ id: user.id }).from(user)).length;
  check("bootstrap idempotent (still one user)", count === 1, `got ${count}`);

  console.info("\n[1b] public signup is disabled");
  const baseURL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const signupResponse = await auth.handler(
    new Request(new URL("/api/auth/sign-up/email", baseURL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: new URL(baseURL).origin },
      body: JSON.stringify({
        email: "uninvited@example.com",
        password: "Sup3rSecret!pw",
        name: "Uninvited",
      }),
    }),
  );
  const signupBody = await signupResponse.json();
  check("public signup returns 400", signupResponse.status === 400);
  check("signup is explicitly disabled", signupBody.code === "EMAIL_PASSWORD_SIGN_UP_DISABLED");
  check("signup sets no session cookie", !signupResponse.headers.has("set-cookie"));
  check("signup creates no user", (await db.select({ id: user.id }).from(user)).length === 1);
  check(
    "signup creates no session",
    (await db.select({ id: session.id }).from(session)).length === 0,
  );

  // Weak password rejected — simulate by calling bootstrap with a weak pw on an
  // empty-ish DB isn't possible now (table not empty), so assert the validator directly.
  console.info("\n[2] password strength + bootstrap weak-password rejection");
  const { assertStrongPassword } = await import("@/server/features/password");
  let weakThrew = false;
  try {
    assertStrongPassword("short");
  } catch {
    weakThrew = true;
  }
  check("weak password rejected by validator", weakThrew);

  console.info("\n[3] pending user blocked at session.create.before");
  // Create a user, flip to pending, attempt sign-in → must fail (no session).
  await auth.api.createUser({
    body: { email: "pending@example.com", password: "Sup3rSecret!pw", name: "Pending" },
  });
  await db.update(user).set({ status: "pending" }).where(eq(user.email, "pending@example.com"));
  const [pendingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, "pending@example.com"));

  await auth.api.requestPasswordReset({ body: { email: "pending@example.com" } });
  const [resetVerification] = pendingUser
    ? await db
        .select({ identifier: verification.identifier })
        .from(verification)
        .where(eq(verification.value, pendingUser.id))
        .limit(1)
    : [];
  const resetToken = resetVerification?.identifier.replace("reset-password:", "");
  check("reset token issued for pending user", !!resetToken);

  let weakResetThrew = false;
  if (resetToken) {
    try {
      await auth.api.resetPassword({
        body: { token: resetToken, newPassword: "password" },
      });
    } catch {
      weakResetThrew = true;
    }
  }
  check("weak reset password rejected", weakResetThrew);

  const [stillPending] = await db
    .select({ status: user.status })
    .from(user)
    .where(eq(user.email, "pending@example.com"));
  check(
    "weak reset did not activate pending user",
    stillPending?.status === "pending",
    `got ${stillPending?.status}`,
  );

  let pendingSignInThrew = false;
  try {
    await auth.api.signInEmail({
      body: { email: "pending@example.com", password: "Sup3rSecret!pw" },
    });
  } catch {
    pendingSignInThrew = true;
  }
  check("pending sign-in blocked", pendingSignInThrew);
  // And no session row should exist for the pending user.
  const pendingSessionsById = pendingUser
    ? (await db.select().from(session).where(eq(session.userId, pendingUser.id))).length
    : -1;
  check(
    "no session row created for pending user",
    pendingSessionsById === 0,
    `got ${pendingSessionsById}`,
  );

  console.info("\n[4] mustChangePassword enforced at shared accessor");
  // The seeded admin has mustChangePassword=true. Sign in, then read via
  // getServerAuth with the response cookies → must report "password-change-required".
  const res = await auth.api.signInEmail({
    body: { email: "admin@example.com", password: "Sup3rSecret!pw" },
    asResponse: true,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  check("sign-in issued a session cookie", setCookie.length > 0);
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const reqHeaders = new Headers({ cookie: cookieHeader });
  const serverAuth = await getServerAuth(reqHeaders);
  check(
    "shared accessor returns password-change-required",
    serverAuth.status === "password-change-required",
    `got ${serverAuth.status}`,
  );

  console.info("\n[5] idle config invariants");
  const authMod: any = await import("@/server/auth");
  // Inspect the config the betterAuth() instance was built with via its options.
  check(
    "expiresIn ~ 15m",
    authMod.auth.options.session?.expiresIn === 900,
    `${authMod.auth.options.session?.expiresIn}`,
  );
  check(
    "updateAge 0 (true sliding idle)",
    authMod.auth.options.session?.updateAge === 0,
    `${authMod.auth.options.session?.updateAge}`,
  );
  check(
    "cookieCache disabled",
    authMod.auth.options.session?.cookieCache?.enabled === false,
    `${authMod.auth.options.session?.cookieCache?.enabled}`,
  );

  console.info("\n[6] clearing mustChangePassword → accessor returns authenticated");
  await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, admin!.id));
  const cleared = await getServerAuth(reqHeaders);
  check(
    "authenticated after clearing flag",
    cleared.status === "authenticated",
    `got ${cleared.status}`,
  );

  console.info(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(2);
});
