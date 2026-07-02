/**
 * Bounded-fetch + lease tuning (tech-plan → "Bounded fetch", critique H4/B2).
 * No numbers are mandated by the contract — these are conservative defaults
 * for a synchronous chat turn against an admin-configured backend.
 */
export const CHAT_UPSTREAM_TIMEOUTS = {
  connectMs: 10_000, // time-to-response-headers
  idleMs: 30_000, // max silence between SSE chunks once streaming
  totalMs: 120_000, // hard cap on the whole request+stream lifetime
} as const;

export const CHAT_SSE_LIMITS = {
  maxLineBytes: 2 * 1024 * 1024, // one `data:` line (the `completed` event echoes the full answer/reasoning)
  maxTotalBytes: 20 * 1024 * 1024, // whole response body
  maxEvents: 5_000,
} as const;

/**
 * Exceeds `totalMs` with margin so a legitimately still-streaming request's
 * lease never expires out from under it — only a crashed/never-released
 * request (one that never reaches its own `totalMs` abort, e.g. the process
 * was killed) becomes takeover-eligible.
 */
export const CHAT_SEND_LEASE_TTL_MS = CHAT_UPSTREAM_TIMEOUTS.totalMs + 30_000;
