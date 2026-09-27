/**
 * Whether an embedded solution's `<iframe>` may keep its real origin via
 * `sandbox="… allow-same-origin"` (genie-ops-center-4ao).
 *
 * Without `allow-same-origin` the frame runs on an opaque origin: every storage
 * API (`localStorage`/`sessionStorage`/`indexedDB`/`document.cookie`) throws
 * and the frame is not a secure context, so `getUserMedia` (microphone/camera)
 * is unavailable — real embedded apps break. Granting the origin back to a
 * CROSS-origin frame is safe: it owns its own origin (storage, secure context)
 * but still cannot touch this app's DOM or session cookies.
 *
 * A SAME-origin embed URL must keep the strict sandbox: scripts + our origin
 * would let the frame read the signed-in user's session. Until composed
 * solutions are a designed feature, this fails closed.
 *
 * Malformed input also fails closed (strict sandbox) — the shared config schema
 * rejects such URLs at write time anyway.
 */
export function embedSandboxAllowSameOrigin(iframeUrl: string, deploymentBaseUrl: string): boolean {
  if (!deploymentBaseUrl) return false;
  try {
    return new URL(iframeUrl).origin !== new URL(deploymentBaseUrl).origin;
  } catch {
    return false;
  }
}
