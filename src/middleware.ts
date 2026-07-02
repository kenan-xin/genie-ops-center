import { NextResponse, type NextRequest } from "next/server";

import { allowedIframeOrigins } from "@/server/config";

/**
 * Runtime response headers that must read per-deployment env (one image, one
 * customer) and so can't live in `next.config.ts` static `headers()`.
 *
 * `Content-Security-Policy: frame-src` — the non-wildcard allow-list for
 * embedded solution iframes (FR-VIEW-04 / tech-plan → Embedded). Origins come
 * from `ALLOWED_IFRAME_ORIGINS`; the iframe's own `sandbox` attribute is the
 * primary defense, this is defense-in-depth. `'self'` is included so any
 * same-origin frame usage still works; the list is empty ⇒ only `'self'`.
 *
 * Applied to every route (the header is harmless where no iframe renders).
 */
export function middleware(_request: NextRequest) {
  const origins = allowedIframeOrigins();
  const frameSrc = ["'self'", ...origins].join(" ");
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", `frame-src ${frameSrc}`);
  return res;
}

export const config = {
  // Every path. The CSP header is cheap and inert where no iframe is rendered.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
  // Node runtime so the `server-only`-guarded config import resolves (it reads
  // process.env, which is all this needs — no edge-specific APIs).
  runtime: "nodejs" as const,
};
