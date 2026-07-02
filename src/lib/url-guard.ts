/**
 * SSRF guard for admin-configured external URLs (the chat streaming endpoint).
 *
 * The streaming endpoint moved from a fixed server env to per-solution config
 * (FR-ADM-S-03), which means the proxy fetches a URL stored from admin input.
 * Admin-only is trusted-ish, not trusted — so a stored `http://169.254.…`
 * metadata URL or `http://localhost` must never be fetched server-side.
 *
 * Two layers:
 *  - {@link safeHttpsUrl} — zod refinement for the config schema (write-time).
 *  - {@link assertSafeExternalUrl} — re-check at the proxy fetch (runtime), so a
 *    row that predates validation or is mutated out-of-band can't bypass it.
 *
 * Rejects non-`https:` and any host that resolves to a private/loopback/link-
 * local range. We do NOT resolve DNS here (TOCTOU + no `node:dns` in edge); the
 * proxy re-checks against the fetched host. If a deployment ever needs to allow
 * a private target, allow-list it explicitly rather than weakening this rule.
 */

/** Literal private/loopback hostnames we always reject (covers common cases without DNS). */
const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "metadata.google.internal"]);

/** True if a hostname *string* is obviously private/loopback. */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  // IPv4 literal
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = m.slice(1).map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  }
  // IPv6 literals
  if (h === "::1" || h === "::") return true; // loopback / unspecified
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 unique-local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

/**
 * Validate + guard an external URL. Returns a clean `URL` (https only, non-private
 * host) or throws. Used at the proxy fetch so a stored-but-invalid URL can't
 * reach `fetch()`.
 */
export function assertSafeExternalUrl(raw: string, field = "endpoint"): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid ${field}: not a URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${field} must be an https URL`);
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error(`${field} must not target a private/loopback address`);
  }
  return url;
}

/**
 * Zod refinement for the config schema: a string that parses as a safe https URL.
 * Pair with a `.refine(safeHttpsUrl, "...")` on the `apiEndpoint` field.
 */
export const safeHttpsUrl = (s: string): boolean => {
  try {
    assertSafeExternalUrl(s);
    return true;
  } catch {
    return false;
  }
};
