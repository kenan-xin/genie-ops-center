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
 * customer. Optional fields (bootstrap credentials and chat configuration) are
 * absent until a deployment needs them.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),

  // Postgres — required for both the app pool and migrations.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // better-auth secret — MUST be ≥32 chars.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
  // This deployment's public URL — better-auth cookies/reset links, and the
  // server-side tRPC client's base (src/trpc/provider.tsx).
  PUBLIC_BASE_URL: z.url("PUBLIC_BASE_URL must be a valid URL"),
  // Proxy IPs/CIDRs to skip when resolving the client from X-Forwarded-For.
  AUTH_TRUSTED_PROXIES: z.string().default(""),

  // Transactional email (invite/reset). If RESEND_API_KEY is absent, local dev
  // falls back to logging links; production callers refuse invite/reset.
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("onboarding@resend.dev"),

  PORT: z.coerce.number().int().positive().default(3000),

  // Approved origins for per-solution chat streaming endpoints (FR-ADM-S-03).
  // The chat endpoint is per-solution config, not a single base — but it must
  // resolve to an origin on THIS list (the SSRF gate + default-seed + rotation
  // point). Comma-separated, e.g. "https://dev-genie.001.gs". Empty ⇒ no chat
  // solution can be saved/streamed until an origin is approved. See url-guard.ts.
  GENIE_CHAT_API_ALLOWED_ORIGINS: z.string().default(""),

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

/** GENIE_CHAT_API_ALLOWED_ORIGINS as a trimmed array (empty string ⇒ []). */
export function chatAllowedOrigins(env = process.env): string[] {
  return (env.GENIE_CHAT_API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function authTrustedProxies(env = process.env): string[] {
  return (env.AUTH_TRUSTED_PROXIES ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}
