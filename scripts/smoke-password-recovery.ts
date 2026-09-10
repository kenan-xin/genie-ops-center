/** Password recovery regression checks. Run against a migrated disposable DB. */
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { adminSetPassword, adminSetTempPassword } from "@/features/users/server/user-service";
import { auth } from "@/server/auth";
import { getServerAuth } from "@/server/authz";
import { db } from "@/server/db";
import { session, user } from "@/server/db/schema";

const password = "Original!9Password";
const newPassword = "Changed!9Password";
const baseURL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
const suffix = crypto.randomUUID();
const fixtureIds: string[] = [];
const clientIPs = new Map<string, string>();
let clientNumber = 1;

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

function request(path: string, cookie = "", body?: object, clientIP = "192.0.2.1") {
  return auth.handler(
    new Request(new URL(`/api/auth${path}`, baseURL), {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(baseURL).origin,
        Cookie: cookie,
        "X-Forwarded-For": clientIPs.get(cookie) ?? clientIP,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

async function createUser(name: string, admin = false) {
  const result = await auth.api.createUser({
    body: {
      name,
      email: `${name}-${suffix}@example.test`,
      password,
      role: admin ? ["user", "admin"] : "user",
    },
  });
  fixtureIds.push(result.user.id);
  return result.user;
}

async function signIn(email: string, currentPassword = password) {
  // Each sign-in represents a separate browser, with its own rate-limit bucket.
  const clientIP = `192.0.2.${++clientNumber}`;
  const response = await request(
    "/sign-in/email",
    "",
    { email, password: currentPassword },
    clientIP,
  );
  assert.equal(response.status, 200);
  const cookie = cookies(response);
  assert.ok(cookie);
  clientIPs.set(cookie, clientIP);
  return cookie;
}

async function assertRevoked(cookie: string) {
  assert.equal(await (await request("/get-session", cookie)).json(), null);
  assert.equal((await getServerAuth(new Headers({ cookie }))).status, "unauthenticated");
  assert.equal((await request("/update-user", cookie, { name: "Stale session" })).status, 401);
}

async function assertActive(cookie: string) {
  assert.equal((await getServerAuth(new Headers({ cookie }))).status, "authenticated");
}

async function main() {
  try {
    const operator = await createUser("operator", true);
    const operatorCookie = await signIn(operator.email);
    const headers = new Headers({ cookie: operatorCookie });
    const target = await createUser("forced");
    const oldCookies = [await signIn(target.email), await signIn(target.email)];

    const { tempPassword } = await adminSetTempPassword(target.id, headers);
    assert.equal((await db.select().from(session).where(eq(session.userId, target.id))).length, 0);
    await Promise.all(oldCookies.map(assertRevoked));
    await assertActive(operatorCookie);

    const recoveryCookie = await signIn(target.email, tempPassword);
    const otherTemporaryCookie = await signIn(target.email, tempPassword);
    assert.equal(
      (await getServerAuth(new Headers({ cookie: recoveryCookie }))).status,
      "password-change-required",
    );
    const badChange = await request("/change-password", recoveryCookie, {
      currentPassword: "Wrong!9Password",
      newPassword,
      revokeOtherSessions: false,
    });
    assert.equal(badChange.status, 400);
    assert.equal((await db.select().from(session).where(eq(session.userId, target.id))).length, 2);

    const changed = await request("/change-password", recoveryCookie, {
      currentPassword: tempPassword,
      newPassword,
      revokeOtherSessions: false,
    });
    assert.equal(changed.status, 200);
    const freshCookie = cookies(changed);
    assert.ok(freshCookie);
    assert.notEqual(freshCookie, recoveryCookie);
    await assertActive(freshCookie);
    await Promise.all([...oldCookies, recoveryCookie, otherTemporaryCookie].map(assertRevoked));
    assert.equal((await db.select().from(session).where(eq(session.userId, target.id))).length, 1);
    console.info(
      "PASS: admin reset revokes old sessions permanently; forced change rotates and revokes temporary sessions",
    );

    const direct = await createUser("direct");
    const directCookie = await signIn(direct.email);
    await adminSetPassword(direct.id, newPassword, headers);
    await assertRevoked(directCookie);
    await assertActive(await signIn(direct.email, newPassword));

    const noChange = await createUser("no-change");
    const noChangeCookie = await signIn(noChange.email);
    const temporary = await adminSetTempPassword(noChange.id, headers, { requireChange: false });
    await assertRevoked(noChangeCookie);
    await assertActive(await signIn(noChange.email, temporary.tempPassword));
    console.info(
      "PASS: direct service reset and requireChange=false both revoke existing sessions",
    );

    const raw = await createUser("raw");
    const rawCookie = await signIn(raw.email);
    assert.equal(
      (await request("/admin/set-user-password", "", { userId: raw.id, newPassword })).status,
      401,
    );
    assert.equal(
      (await request("/admin/set-user-password", rawCookie, { userId: raw.id, newPassword }))
        .status,
      403,
    );
    assert.equal(
      (
        await request("/admin/set-user-password", operatorCookie, {
          userId: raw.id,
          newPassword: "weak",
        })
      ).status,
      400,
    );
    await assertActive(rawCookie);
    assert.equal(
      (await request("/admin/set-user-password", operatorCookie, { userId: raw.id, newPassword }))
        .status,
      200,
    );
    await assertRevoked(rawCookie);
    await assertActive(await signIn(raw.email, newPassword));
    await assertActive(operatorCookie);
    console.info(
      "PASS: raw admin reset revokes target sessions; failures and unrelated sessions remain unaffected",
    );

    // The normal account settings flow retains its existing user-selected policy.
    const normal = await createUser("normal");
    const normalCookie = await signIn(normal.email);
    const normalOtherCookie = await signIn(normal.email);
    assert.equal(
      (
        await request("/change-password", normalCookie, {
          currentPassword: password,
          newPassword,
          revokeOtherSessions: false,
        })
      ).status,
      200,
    );
    await assertActive(normalCookie);
    await assertActive(normalOtherCookie);

    assert.equal(
      (
        await request("/admin/set-user-password", operatorCookie, {
          userId: operator.id,
          newPassword,
        })
      ).status,
      200,
    );
    await assertRevoked(operatorCookie);
    await assertActive(await signIn(operator.email, newPassword));
    console.info(
      "PASS: normal password-change preference preserved; self-reset revokes the administrator session",
    );
  } finally {
    if (fixtureIds.length) await db.delete(user).where(inArray(user.id, fixtureIds));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("password-recovery smoke failed:", error);
    process.exit(1);
  });
