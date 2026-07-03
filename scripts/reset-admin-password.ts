/**
 * Dev-only — reset an admin's password WITHOUT wiping the local DB.
 *
 * The admin lifecycle tests (and any live "reset password" action run against
 * the dev DB) can leave the seeded local admin locked out: password changed to
 * an unknown value and/or `mustChangePassword` set. This restores a known,
 * strong login in place, so you don't have to `pnpm db:dev:reset` (which wipes
 * the whole volume).
 *
 * NOT for production: it writes the credential directly (via better-auth's own
 * internal adapter — the same call `POST /admin/set-user-password` makes), so it
 * bypasses the admin session a real reset requires. Guarded by NODE_ENV.
 *
 * Usage (with the dev DB running — `pnpm db:dev`):
 *   pnpm reset-admin                                  # admin@example.com / Sup3rSecret!pw
 *   pnpm reset-admin you@example.com 'YourStr0ng!pw'  # custom target + password
 *
 * The `reset-admin` package.json script esbuild-bundles this file (with
 * `--conditions=react-server`, mirroring `build:entrypoint`) and runs the bundle
 * with node — so `server-only` resolves to its no-op at bundle time and no
 * script-runner dependency (tsx/ts-node) is needed.
 *
 * Reads DATABASE_URL / ADMIN_EMAIL / ADMIN_PASSWORD from the environment if set;
 * otherwise falls back to the docker-compose.dev.yml / .env.example defaults.
 */

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("✗ Refusing to run in production — this bypasses the admin-session reset flow.");
    process.exit(1);
  }

  // Dev fallbacks set BEFORE importing @/server/* — the db client throws when
  // DATABASE_URL is unset and it's imported transitively by `auth`, so these
  // must land first. A real env value always wins (?? only fills the gap).
  process.env.DATABASE_URL ??= "postgres://genie:genie@localhost:5432/genie";
  process.env.BETTER_AUTH_SECRET ??= "dev-only-secret-change-me";

  const email = process.argv[2] ?? process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "Sup3rSecret!pw";

  const { auth } = await import("@/server/auth");
  const { db } = await import("@/server/db");
  const { user } = await import("@/server/db/schema");
  const { assertStrongPassword } = await import("@/server/features/password");
  const { eq } = await import("drizzle-orm");

  assertStrongPassword(password); // reject a weak dev password up front

  const [target] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!target) {
    console.error(
      `✗ No user with email "${email}". Migrate + bootstrap the DB first (pnpm db:dev).`,
    );
    process.exit(1);
  }

  // Hash + write the credential exactly as better-auth's own set-user-password
  // endpoint does: updatePassword updates the credential account (creating one
  // if the user somehow lacks it).
  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(password);
  await ctx.internalAdapter.updatePassword(target.id, hashed);

  // Clear the lifecycle flags that block sign-in. These raw column writes don't
  // fire the `account.update` DB hook, so clear `mustChangePassword` explicitly.
  await db
    .update(user)
    .set({ mustChangePassword: false, banned: false, status: "active" })
    .where(eq(user.id, target.id));

  console.info(`✓ Reset "${email}" — password set, mustChangePassword cleared, unbanned, active.`);
  console.info(`  Sign in:  ${email}  /  ${password}`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
