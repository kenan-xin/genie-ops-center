/**
 * Egress guard for the admin-configured chat streaming endpoint (FR-ADM-S-03).
 *
 * The endpoint is per-solution config, so the proxy fetches a URL stored from
 * admin input. Trust model (decided): an **ops allow-list of approved origins**
 * (`GENIE_CHAT_API_ALLOWED_ORIGINS`) is the authority — a stored endpoint is
 * valid only if its origin is on that list. That makes SSRF tractable: the host
 * is pre-approved, so we don't chase DNS-rebinding across the whole internet;
 * the proxy just uses `redirect: "manual"` and re-validates any redirect target
 * against the same list.
 *
 * Layers:
 *  - {@link assertAllowedEndpoint} — the authoritative gate (server): origin ∈
 *    allow-list. Used at the tRPC write boundary AND before the proxy fetch.
 *  - {@link safeHttpsUrl} — client-safe baseline for the shared zod schema
 *    (https + not-obviously-private), so the form gives good UX without needing
 *    the server-only allow-list. NOT sufficient on its own — the allow-list is.
 *
 * `isPrivateHost` is defense-in-depth (belt-and-suspenders behind the allow-list)
 * and is string-only — no DNS. It decodes IPv4-mapped IPv6 (the one literal that
 * `new URL()` canonicalization doesn't fold into dotted-quad).
 */

/** Literal private/loopback hostnames we always reject. */
const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "metadata.google.internal"]);

function ipv4IsPrivate(a: number, b: number): boolean {
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** True if a hostname *string* is obviously private/loopback (no DNS). */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (BLOCKED_HOSTNAMES.has(h)) return true;

  // IPv4 dotted-quad (new URL() already folds decimal/hex/octal into this form).
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) return ipv4IsPrivate(Number(m[1]), Number(m[2]));

  // IPv4-mapped IPv6 — new URL() emits the compressed hex form (::ffff:a9fe:a9fe)
  // for e.g. ::ffff:169.254.169.254, which the checks below would otherwise miss.
  const mapped = h.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    const dotted = tail.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (dotted) return ipv4IsPrivate(Number(dotted[1]), Number(dotted[2]));
    const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      // The first hex group holds the top two octets, which classify every range
      // we block: a = high byte, b = low byte. (e.g. a9fe → 169.254)
      const g1 = parseInt(hex[1], 16);
      return ipv4IsPrivate(g1 >> 8, g1 & 0xff);
    }
  }

  // IPv6 literals
  if (h === "::1" || h === "::") return true; // loopback / unspecified
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

/** Parse + basic-validate: valid `https:` URL to a non-obviously-private host. */
function parseHttpsUrl(raw: string, field: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid ${field}: not a URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${field} must be an https URL`);
  if (isPrivateHost(url.hostname)) {
    throw new Error(`${field} must not target a private/loopback address`);
  }
  return url;
}

/**
 * The authoritative gate (server-side): the URL must be valid https, not private,
 * AND its origin must be in `allowedOrigins`. Used at the tRPC write boundary and
 * re-checked before the live experience (chat fetch / iframe render). Throws on fail.
 *
 * `emptyListMessage` lets callers name the relevant env var when no chat
 * origins are approved.
 */
export function assertAllowedEndpoint(
  raw: string,
  allowedOrigins: string[],
  field = "endpoint",
  emptyListMessage = `${field} rejected: no origins are allow-listed`,
): URL {
  const url = parseHttpsUrl(raw, field);
  const allowed = new Set(allowedOrigins.map((o) => o.trim().replace(/\/$/, "")).filter(Boolean));
  if (allowed.size === 0) {
    throw new Error(emptyListMessage);
  }
  if (!allowed.has(url.origin)) {
    throw new Error(`${field} origin ${url.origin} is not in the approved allow-list`);
  }
  return url;
}

/** Boolean form of {@link assertAllowedEndpoint}. */
export function isAllowedEndpoint(raw: string, allowedOrigins: string[]): boolean {
  try {
    assertAllowedEndpoint(raw, allowedOrigins);
    return true;
  } catch {
    return false;
  }
}

/**
 * Client-safe zod refinement for the shared config schema: valid https URL to a
 * non-private host. This is a UX baseline only — the origin allow-list is the
 * real gate and runs server-side (the allow-list isn't available client-side).
 */
export const safeHttpsUrl = (s: string): boolean => {
  try {
    parseHttpsUrl(s, "endpoint");
    return true;
  } catch {
    return false;
  }
};
