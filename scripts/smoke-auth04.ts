/**
 * Smoke check for ticket 04 auth-flow server wiring. Run against a migrated DB.
 * Complements scripts/smoke-identity.ts (foundation invariants); this one proves
 * the pieces ticket 04 adds/relies on:
 *   1. shared password rule still enforced after the client-safe extraction
 *   2. signIn.email response carries the fields the client routes on
 *      (mustChangePassword + role)
 *   3. an in-session change-password clears mustChangePassword (account.update
 *      hook) → the forced-change loop terminates
 *   4. a token reset both activates a pending user (onPasswordReset) and clears
 *      any mustChangePassword (account.update hook)
 * Not a test framework — asserts, exits non-zero on the first failure.
 */
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user, verification } from "@/server/db/schema";
import { passwordSchema, strength } from "@/lib/password-strength";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.info(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

const STRONG = "Str0ng-New-Pw!";
const STRONG2 = "An0ther-Str0ng-Pw!";

function cookieFrom(res: Response): string {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  console.info("\n[1] shared password rule still enforced after extraction");
  check("strength weak < 3", strength("abc") < 3);
  check("strength strong >= 3", strength(STRONG) >= 3);
  check("schema rejects short", passwordSchema.safeParse("Ab3!x").success === false);
  check("schema accepts strong", passwordSchema.safeParse(STRONG).success === true);

  console.info("\n[2] signIn.email response carries mustChangePassword + role");
  await auth.api.signUpEmail({ body: { email: "chg@t.co", password: STRONG, name: "Chg" } });
  const [chg] = await db.select().from(user).where(eq(user.email, "chg@t.co")).limit(1);
  await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, chg!.id));

  const signIn = await auth.api.signInEmail({ body: { email: "chg@t.co", password: STRONG } });
  check(
    "response.user.mustChangePassword present & true",
    (signIn.user as { mustChangePassword?: boolean }).mustChangePassword === true,
  );
  check(
    "response.user.role present",
    typeof (signIn.user as { role?: string }).role === "string",
    `got ${(signIn.user as { role?: string }).role}`,
  );

  console.info("\n[3] in-session change-password clears mustChangePassword");
  const res = await auth.api.signInEmail({
    body: { email: "chg@t.co", password: STRONG },
    asResponse: true,
  });
  const headers = new Headers({ cookie: cookieFrom(res) });
  await auth.api.changePassword({
    body: { currentPassword: STRONG, newPassword: STRONG2 },
    headers,
  });
  const [afterChange] = await db
    .select({ m: user.mustChangePassword })
    .from(user)
    .where(eq(user.id, chg!.id));
  check(
    "mustChangePassword cleared by change-password",
    afterChange?.m === false,
    `got ${afterChange?.m}`,
  );

  console.info("\n[4] token reset activates pending + clears mustChangePassword");
  await auth.api.signUpEmail({ body: { email: "inv@t.co", password: STRONG, name: "Inv" } });
  const [inv] = await db.select().from(user).where(eq(user.email, "inv@t.co")).limit(1);
  await db
    .update(user)
    .set({ status: "pending", mustChangePassword: true })
    .where(eq(user.id, inv!.id));
  await auth.api.requestPasswordReset({ body: { email: "inv@t.co" } });
  const [v] = await db
    .select({ identifier: verification.identifier })
    .from(verification)
    .where(eq(verification.value, inv!.id))
    .limit(1);
  const token = v?.identifier.replace("reset-password:", "");
  check("reset token issued", !!token);
  if (token) {
    await auth.api.resetPassword({ body: { token, newPassword: STRONG2 } });
  }
  const [afterReset] = await db
    .select({ status: user.status, m: user.mustChangePassword })
    .from(user)
    .where(eq(user.id, inv!.id));
  check(
    "pending → active on reset (onPasswordReset)",
    afterReset?.status === "active",
    `got ${afterReset?.status}`,
  );
  check("mustChangePassword cleared on reset", afterReset?.m === false, `got ${afterReset?.m}`);

  // cleanup
  await db.delete(user).where(eq(user.email, "chg@t.co"));
  await db.delete(user).where(eq(user.email, "inv@t.co"));

  console.info(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(2);
});
