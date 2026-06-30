// Container entrypoint (ticket 03b). Bundled by esbuild at image build time and
// run with `node --conditions react-server` (so the `server-only` marker in the
// server graph resolves to its empty implementation, as it does inside Next).
//
// Sequence on every boot:
//   1. parseConfig() — run first, so an invalid/missing env fails fast BEFORE
//      any DB work or server start.
//   2. Check out ONE dedicated Client from the pool and hold it for the whole
//      sequence. Acquire a session-level Postgres advisory lock on THAT client,
//      then run migrate + bootstrap on the SAME client. Session advisory locks
//      bind to a backend — if migrate ran on a different pooled connection the
//      lock wouldn't protect it, and concurrent replica starts would race the
//      migration (journal row written, DDL rolled back → schema/journal skew).
//      We poll a try-lock rather than blocking on pg_advisory_lock, so a replica
//      that can't get the lock within LOCK_TIMEOUT_MS fails loudly, not hang.
//   3. drizzle-orm migrator — the ONLY migration path (drizzle owns the history
//      in ./drizzle; better-auth's own migrate is never run). Programmatic
//      `migrate()` is the same engine `drizzle-kit migrate` uses, run on the
//      locked connection, so it needs only drizzle-orm + the SQL folder at
//      runtime — no drizzle-kit CLI in the image.
//   4. bootstrapAdmin() — seeds the first admin iff the user table is empty.
//   5. Release the lock, release the client, then start the standalone server.
//
// One image, one deployment per customer. Secrets only from env.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PoolClient } from "pg";
import { Pool } from "pg";

import { parseConfig } from "@/server/config";

// Validate env NOW — an invalid/missing value fails fast before any DB work.
// (App modules still read process.env directly; they don't throw at build time,
// only this entrypoint-side gate does, at runtime.)
const config = parseConfig();

const LOCK_KEY = 0x00e1e0_03b; // stable 32-bit key for the "deploy bootstrap" lock
const LOCK_POLL_MS = 1000;
const LOCK_TIMEOUT_MS = Number(process.env.LOCK_TIMEOUT_MS ?? 120_000);

// The migration folder ships alongside the entrypoint bundle (see Dockerfile).
const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), "drizzle");

function log(msg: string): void {
  console.info(`[entrypoint] ${msg}`);
}

/**
 * Poll for the advisory lock on the given client until acquired or the timeout
 * elapses. MUST run on the same client that later runs migrate + bootstrap.
 */
async function waitForLock(client: PoolClient): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  // Sequential by design: we poll a try-lock with a backoff sleep, not fan-out.
  // eslint-disable-next-line no-await-in-loop
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await client.query("SELECT pg_try_advisory_lock($1)", [LOCK_KEY]);
    if (rows[0]?.pg_try_advisory_lock === true) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
  }
  throw new Error(
    `timed out after ${LOCK_TIMEOUT_MS}ms waiting for the migration advisory lock — another replica may be stuck`,
  );
}

async function releaseLock(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
}

async function main(): Promise<void> {
  log("booting (config validated)");

  // One pool just to check out the single locked client. The standalone server
  // (and the app's own db/auth) create their own pools after we start it.
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const client: PoolClient = await pool.connect();
  try {
    await waitForLock(client);
    log("advisory lock acquired");
    log("applying drizzle migrations");
    // Run the migrator on the SAME client that holds the lock.
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    const { bootstrapAdmin } = await import("@/server/bootstrap");
    await bootstrapAdmin();
  } finally {
    await releaseLock(client);
    client.release();
    await pool.end();
    log("advisory lock released");
  }

  log("starting standalone server");
  // Replace this process with the standalone Next server so signals (SIGTERM)
  // route directly to it and it becomes PID 1's child.
  const server = spawn("node", ["server.js"], {
    stdio: "inherit",
    env: process.env,
  });
  server.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(`[entrypoint] fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
