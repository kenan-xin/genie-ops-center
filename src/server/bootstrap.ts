import "server-only";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { assertStrongPassword } from "@/server/features/password";

/**
 * Guarded first-admin bootstrap (tech-plan → "First-admin bootstrap").
 *
 * No public signup. On startup, ONLY if the `user` table is empty, seed one
 * `user,admin` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` — but validate the password
 * against the shared strength rule, set `mustChangePassword` (the operator knows
 * this password), and log a one-time event. Idempotent: once any user exists,
 * this is a no-op even if the env vars are present. Ops clears ADMIN_PASSWORD
 * after first boot.
 *
 * Invoked by the container entrypoint (ticket 03b); safe to call on every boot.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return; // nothing to do
  }

  // Idempotency: only seed the very first user.
  const [existing] = await db.select({ id: user.id }).from(user).limit(1);
  if (existing) {
    return;
  }

  assertStrongPassword(password); // rejects a weak operator password — fail fast

  // createUser works without an admin session (there is none yet), which is the
  // one legitimate sessionless use. Better Auth persists role arrays and custom
  // additionalFields supplied through `data`, so the first admin is seeded
  // atomically rather than relying on a follow-up repair write.
  await auth.api.createUser({
    body: {
      email,
      name: "Administrator",
      password,
      role: ["user", "admin"] as ("user" | "admin")[],
      data: { mustChangePassword: true, status: "active" },
    },
  });

  // eslint-disable-next-line no-console
  console.info(
    `[bootstrap] seeded initial admin ${email} (mustChangePassword set). Clear ADMIN_PASSWORD now.`,
  );
}
