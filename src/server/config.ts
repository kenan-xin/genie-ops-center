import "server-only";

import { z } from "zod";

/**
 * Runtime config — the single source of truth for the deployment env contract,
 * zod-validated at boot (fail fast). The container entrypoint calls
 * `parseConfig()` BEFORE starting the server, so a missing/invalid value
 * crashes the replica loudly instead of serving half-broken requests.
 *
 * App modules (db, auth, bootstrap) read `process.env` directly — they are also
 * evaluated by `next build` (page-data collection), so they must not throw when
 * env is absent at build time. The fail-fast gate lives here, run by the
 * entrypoint at runtime only. See tech-plan → "Config/secrets (env)", ticket 03b.
 *
 * Secrets come only from env (never baked). One image, one deployment per
 * customer. Optional fields (bootstrap creds, chat token, iframe origins) are
 * absent until a deployment needs them.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),

  // Postgres — required for both the app pool and migrations.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // better-auth — secret MUST be ≥32 chars; baseURL is the public URL of this
  // deployment (used for cookies/reset links).
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),

  PORT: z.coerce.number().int().positive().default(3000),

  // External Genie chat API — public (no auth token needed). Base may be empty
  // until the chat ticket lands.
  EXTERNAL_CHAT_API_BASE: z.url().or(z.literal("")).default(""),

  // iframe CSP frame-src allow-list. Comma-separated origins; empty ⇒ none.
  ALLOWED_IFRAME_ORIGINS: z.string().default(""),

  // First-admin bootstrap. Absent after first boot (ops clears them). The
  // strength of ADMIN_PASSWORD is re-checked by bootstrapAdmin before seeding.
  ADMIN_EMAIL: z.email().or(z.literal("")).default(""),
  ADMIN_PASSWORD: z.string().default(""),
});

export type RuntimeConfig = z.infer<typeof configSchema>;

/**
 * Validate and parse the runtime env. Throws a readable error listing every
 * bad field (fail fast). Run once by the container entrypoint at boot.
 */
export function parseConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid runtime configuration:\n${issues}`);
  }
  return parsed.data;
}

/** ALLOWED_IFRAME_ORIGINS as a trimmed array (empty string ⇒ []). */
export function allowedIframeOrigins(env = process.env): string[] {
  return (env.ALLOWED_IFRAME_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
