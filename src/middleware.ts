import { NextResponse, type NextRequest } from "next/server";

/**
 * Runtime response headers that must read per-deployment env (one image, one
 * customer) and so can't live in `next.config.ts` static `headers()`.
 *
 * `Content-Security-Policy: frame-src` — embedded solutions are administrator-
 * configured public HTTPS apps. The iframe's sandbox is the primary defense;
 * `https:` permits self-service setup while excluding HTTP and non-web schemes.
 * `'self'` preserves same-origin frame usage.
 *
 * Applied to every route (the header is harmless where no iframe renders).
 */
export function middleware(_request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", "frame-src 'self' https:");
  return res;
}

export const config = {
  // Every path. The CSP header is cheap and inert where no iframe is rendered.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
  // Node runtime so the `server-only`-guarded config import resolves (it reads
  // process.env, which is all this needs — no edge-specific APIs).
  runtime: "nodejs",
};
