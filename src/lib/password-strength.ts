import { z } from "zod";

/**
 * Shared password-strength rule — the SINGLE source for both the server
 * (better-auth strength plugin, bootstrap, admin-set) and the client strength
 * meter. Lives in `lib/` (NOT `server-only`) so the meter and the RHF
 * `zodResolver` import the exact same rule the server enforces — no duplication.
 * (tech-plan → "Password reset / change".)
 */

/** Minimum acceptable strength ("Good"). */
export const MIN_STRENGTH = 3;

/** 0–5 strength buckets; ≥3 is acceptable. */
export function strength(pw: string): number {
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

/**
 * Shared password schema (UI meter + server use the same one). Strength ≥3 of:
 * length≥10, lowercase, uppercase, digit, symbol; min length 8.
 */
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .refine(
    (pw) => strength(pw) >= MIN_STRENGTH,
    "Use a stronger password (3 of: length, lower, upper, digit, symbol)",
  );

export type StrengthTone = "weak" | "fair" | "good";

/** Meter label + tone for a 0–5 score. ≥3 ("Good") clears the gate. */
export function strengthMeta(score: number): { label: string; tone: StrengthTone } {
  if (score <= 1) return { label: "Weak", tone: "weak" };
  if (score === 2) return { label: "Fair", tone: "fair" };
  if (score === 3) return { label: "Good", tone: "good" };
  if (score === 4) return { label: "Strong", tone: "good" };
  return { label: "Very strong", tone: "good" };
}
