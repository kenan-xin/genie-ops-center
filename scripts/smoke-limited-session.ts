/**
 * Run against a migrated disposable DB, like smoke-auth04.ts.
 * Exercises the actual Better Auth HTTP handler and server API with limited
 * and normal sessions. Email delivery is mocked; all fixtures are removed.
 */
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user, verification } from "@/server/db/schema";

const password = "Sup3rSecret!pw";
const newPassword = "An0therStrong!pw";
const baseURL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
const suffix = crypto.randomUUID();
const adminEmail = `limited-admin-${suffix}@example.test`;
const memberEmail = `limited-member-${suffix}@example.test`;
const createdEmail = `created-${suffix}@example.test`;

function request(path: string, cookie = "", body?: object, clientIP = "192.0.2.1") {
  return auth.handler(
    new Request(new URL(`/api/auth${path}`, baseURL), {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(baseURL).origin,
        Cookie: cookie,
        "X-Forwarded-For": clientIP,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

async function signIn(email: string, currentPassword = password) {
  const response = await request(
    "/sign-in/email",
    "",
    { email, password: currentPassword },
    email === memberEmail ? "192.0.2.2" : "192.0.2.1",
  );
  assert.equal(response.status, 200);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  return cookie;
}

async function forbidden(response: Response) {
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "PASSWORD_CHANGE_REQUIRED");
}

async function main() {
  const originalFetch = globalThis.fetch;
  const originalMailerKey = process.env.RESEND_API_KEY;
  let deliveries = 0;
  process.env.RESEND_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    deliveries++;
    return Response.json({ id: "test-email" });
  };

  try {
    const admin = await auth.api.createUser({
      body: {
        email: adminEmail,
        name: "Limited admin",
        password,
        role: ["user", "admin"],
        data: { mustChangePassword: true },
      },
    });
    const member = await auth.api.createUser({
      body: { email: memberEmail, name: "Member", password },
    });
    let adminCookie = await signIn(adminEmail);
    const headers = new Headers({ cookie: adminCookie });

    assert.equal((await request("/get-session", adminCookie)).status, 200);
    await forbidden(await request("/admin/list-users", adminCookie));
    await forbidden(
      await request("/admin/create-user", adminCookie, {
        email: createdEmail,
        name: "Created admin",
        password,
        role: "admin",
      }),
    );
    await forbidden(
      await request("/admin/update-user", adminCookie, {
        userId: admin.user.id,
        data: { mustChangePassword: false },
      }),
    );
    await forbidden(
      await request("/admin/set-role", adminCookie, {
        userId: member.user.id,
        role: "admin",
      }),
    );
    await forbidden(await request("/update-user", adminCookie, { name: "Bypassed" }));
    await forbidden(await request("/list-sessions", adminCookie));
    assert.equal((await db.select().from(user).where(eq(user.email, createdEmail))).length, 0);
    const [unchangedAdmin] = await db.select().from(user).where(eq(user.id, admin.user.id));
    const [unchangedMember] = await db.select().from(user).where(eq(user.id, member.user.id));
    assert.equal(unchangedAdmin.mustChangePassword, true);
    assert.equal(unchangedAdmin.name, "Limited admin");
    assert.equal(unchangedMember.role, "user");
    await assert.rejects(
      auth.api.listUsers({ query: {}, headers }),
      (error: { status?: string; body?: { code?: string } }) =>
        error.status === "FORBIDDEN" && error.body?.code === "PASSWORD_CHANGE_REQUIRED",
    );
    console.info("PASS: limited admin reads and mutations blocked on HTTP and server API");

    assert.equal((await request("/sign-out", adminCookie, {})).status, 200);
    assert.equal(await (await request("/get-session", adminCookie)).json(), null);
    adminCookie = await signIn(adminEmail);
    const wrongPassword = await request("/change-password", adminCookie, {
      currentPassword: "WrongPassword1!",
      newPassword,
    });
    assert.equal(wrongPassword.status, 400);
    await forbidden(await request("/admin/list-users", adminCookie));
    assert.equal(
      (
        await request("/change-password", adminCookie, {
          currentPassword: password,
          newPassword,
        })
      ).status,
      200,
    );
    const fresh = await (await request("/get-session", adminCookie)).json();
    assert.equal(fresh.user.mustChangePassword, false);
    assert.equal((await request("/admin/list-users", adminCookie)).status, 200);
    assert.equal(
      (
        await request("/admin/create-user", adminCookie, {
          email: createdEmail,
          name: "Created member",
          password,
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/update-user", adminCookie, { name: "Updated admin" })).status,
      200,
    );
    console.info("PASS: sign-out and password change work; normal admin access resumes");

    assert.equal((await request("/admin/list-users")).status, 401);
    assert.equal(
      (
        await request("/admin/create-user", "", {
          email: `anonymous-${suffix}@example.test`,
          name: "Anonymous",
          password,
        })
      ).status,
      401,
    );
    const memberCookie = await signIn(memberEmail);
    assert.equal((await request("/admin/list-users", memberCookie)).status, 403);
    assert.equal(
      (await request("/update-user", memberCookie, { name: "Updated member" })).status,
      200,
    );
    // Set the flag after sign-in to catch stale-session permission checks.
    await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, member.user.id));
    await forbidden(await request("/update-user", memberCookie, { name: "Blocked member" }));
    assert.equal(
      (
        await request("/request-password-reset", memberCookie, {
          email: memberEmail,
          redirectTo: `${baseURL}/reset-password`,
        })
      ).status,
      200,
    );
    assert.equal(deliveries, 1);
    const [tokenRow] = await db
      .select()
      .from(verification)
      .where(eq(verification.value, member.user.id));
    assert.ok(tokenRow);
    const token = tokenRow.identifier.replace("reset-password:", "");
    const callback = await request(
      `/reset-password/${token}?callbackURL=${encodeURIComponent(`${baseURL}/reset-password`)}`,
      memberCookie,
    );
    assert.equal(callback.status, 302);
    assert.equal(
      (await request("/reset-password", memberCookie, { token, newPassword })).status,
      200,
    );
    const resetCookie = await signIn(memberEmail, newPassword);
    assert.equal(
      (await request("/update-user", resetCookie, { name: "Recovered member" })).status,
      200,
    );
    console.info("PASS: anonymous/member guards hold; limited member password reset works");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMailerKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalMailerKey;
    await db
      .delete(user)
      .where(
        inArray(user.email, [
          adminEmail,
          memberEmail,
          createdEmail,
          `anonymous-${suffix}@example.test`,
        ]),
      );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("limited-session smoke failed:", error);
    process.exit(1);
  });
