/**
 * Explicit security config for rendering the external Genie `answer` (ticket
 * 14, acceptance: "Streamdown security is explicit, not default"). The
 * external API embeds raw inline HTML — `<strong>`, `<span style="color:
 * #52c41a;">` — and a delta can split mid-tag/mid-attribute (see
 * external-chat-api-contract). Streamdown (2.5.x) already sanitizes raw HTML,
 * strips inline `style`, and blocks dangerous link/image protocols by
 * default — verified empirically against the installed version, since its
 * public API no longer exposes the `rehype-harden` allow-list knobs the
 * tech-plan was written against. `chatUrlTransform` and `allowedTags`/
 * `dataTone` below make that intent explicit and auditable in our own code
 * rather than relying on a third-party default that could change.
 *
 * Covered by scripts/smoke-chat-response-security.ts.
 */

export type Tone = "success" | "warn" | "error" | "neutral";

/** Only these link/image protocols ever reach the DOM (no wildcard). */
const ALLOWED_LINK_PROTOCOLS = new Set(["https:", "mailto:"]);
const ALLOWED_IMAGE_PROTOCOLS = new Set(["https:"]);

/**
 * Streamdown's `urlTransform`: called for every `href`/`src` it renders.
 * Returning `null` drops the attribute entirely (Streamdown/its `linkSafety`
 * layer also blocks known-dangerous schemes like `javascript:`/`data:`
 * upstream of this, but the allow-list here is the explicit, documented
 * boundary — not an implicit default we're trusting to stay put).
 *
 * Requires ABSOLUTE URLs (review P1-B): parsing is done WITHOUT a base, so a
 * relative URL (`/api/…`, `//host/…`) — which a base would resolve to `https:`
 * — fails to parse and is rejected. A relative `src`/`href` otherwise reaches
 * the DOM same-origin and carries session cookies to app routes on load. The
 * returned value is the parsed absolute URL (never the original input), so a
 * can't-happen parse/`href` round-trip drift can't slip a value through.
 */
export function chatUrlTransform(url: string, key: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const allowed = key === "src" ? ALLOWED_IMAGE_PROTOCOLS : ALLOWED_LINK_PROTOCOLS;
  return allowed.has(parsed.protocol) ? parsed.href : null;
}

/** Only this tag/attribute pair is allowed beyond Streamdown's own defaults. */
export const CHAT_ALLOWED_TAGS: Record<string, string[]> = { span: ["dataTone"] };

/**
 * Buckets a `#RRGGBB`-ish hex into one of Ledger's closed tone set by hue —
 * the raw hex never reaches the DOM, only one of these four class names does.
 * Grayscale (low saturation) collapses to `neutral`; anything unparsable also
 * falls back to `neutral` (never re-allow arbitrary color).
 */
export function hexToTone(hex: string): Tone {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return "neutral";
  const n = Number.parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24) return "neutral"; // near-gray, no dominant hue

  if (g === max && g - r > 15 && g - b > 15) return r > 120 ? "warn" : "success"; // yellow-green vs green
  if (r === max && r - g > 15 && r - b > 15) return "error"; // red-dominant
  if (r === max && g > b && r - b > 20 && g - b > 10 && r - g < 80) return "warn"; // orange/amber
  return "neutral";
}

// Matches only a COMPLETE `<span style="color:#hex[;]">content</span>` — a
// dangling/partial tag (mid-stream) simply won't match and passes through
// untouched to Streamdown's own incomplete-markup handling + default
// sanitizer (which strips `style`), matching the documented fallback: "if
// brittle, strip color — never re-allow style".
const COLOR_SPAN =
  /<span\s+style\s*=\s*"color:\s*(#[0-9a-fA-F]{6})\s*;?\s*"\s*>([\s\S]*?)<\/span>/g;

/** Rewrites known color spans to Ledger `data-tone` spans (see globals.css). */
export function mapColorSpansToTone(text: string): string {
  return text.replace(COLOR_SPAN, (_full, hex: string, content: string) => {
    return `<span data-tone="${hexToTone(hex)}">${content}</span>`;
  });
}
