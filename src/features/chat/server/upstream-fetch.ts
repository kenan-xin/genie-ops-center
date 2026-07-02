import { assertAllowedEndpoint } from "@/lib/url-guard";

import { UpstreamResponseError, UpstreamSsrfError, UpstreamTimeoutError } from "./errors";
import type { GenieChatRequestBody } from "./genie-contract";

/**
 * The bounded, SSRF-safe fetch to the admin-configured Genie endpoint
 * (tech-plan → "Bounded fetch" / critique H4, and "Endpoint (FR-ADM-S-03)").
 *
 * Two independent defenses compose here:
 *  - **SSRF**: the endpoint's origin is already gated at the write boundary
 *    (`solutions` router), but a stored row could go stale (env rotated) or be
 *    edited out-of-band, so we re-run `assertAllowedEndpoint` here, AND set
 *    `redirect: "manual"` + re-validate every 3xx `Location` against the same
 *    allow-list before following it (a naive `fetch` with default
 *    `redirect: "follow"` would chase a redirect to an internal URL without
 *    ever re-checking — that's the residual hole this closes).
 *  - **Bounded upstream (H4)**: a hung/tarpit endpoint can't pin a request
 *    forever. `connect` bounds time-to-response-headers, `idle` bounds
 *    silence between body chunks, `total` bounds the whole request+stream
 *    lifetime. The caller's `request.signal` (client disconnect) is wired in
 *    too, so a closed browser tab cancels the upstream call.
 */

export type UpstreamTimeouts = {
  connectMs: number;
  idleMs: number;
  totalMs: number;
};

const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * A live upstream connection, plus a `resetIdle` hook the SSE reader calls on
 * every chunk (keeps the idle timer from firing while data is still
 * flowing), and a `dispose` to clear every pending timer once the stream is
 * fully consumed (success or error) so nothing outlives the request.
 */
export type BoundedUpstream = {
  response: Response;
  resetIdle: () => void;
  dispose: () => void;
};

export async function fetchGenieStream(params: {
  endpoint: string;
  allowedOrigins: string[];
  body: GenieChatRequestBody;
  clientSignal: AbortSignal;
  timeouts: UpstreamTimeouts;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}): Promise<BoundedUpstream> {
  const { allowedOrigins, body, clientSignal, timeouts, fetchImpl = fetch } = params;

  // Validate before allocating any controller/timer state — a rejection here
  // must not leak a dangling timer or listener. Normalize the plain `Error`
  // `assertAllowedEndpoint` throws to our typed SSRF error (see the redirect
  // branch below for why).
  let currentUrl: string;
  try {
    currentUrl = assertAllowedEndpoint(params.endpoint, allowedOrigins, "apiEndpoint").toString();
  } catch (e) {
    throw new UpstreamSsrfError(e instanceof Error ? e.message : String(e));
  }

  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let totalTimer: ReturnType<typeof setTimeout> | undefined;

  const clearAllTimers = () => {
    clearTimeout(idleTimer);
    clearTimeout(connectTimer);
    clearTimeout(totalTimer);
  };

  // A typed reason on every abort() call — including the client's own — so
  // the catch below can always rethrow `controller.signal.reason` directly
  // and get accurate, consistent error classification.
  const onClientAbort = () => controller.abort(new UpstreamTimeoutError("client-disconnect"));
  if (clientSignal.aborted) {
    onClientAbort();
  } else {
    clientSignal.addEventListener("abort", onClientAbort, { once: true });
  }

  const dispose = () => {
    clearAllTimers();
    clientSignal.removeEventListener("abort", onClientAbort);
  };

  totalTimer = setTimeout(
    () => controller.abort(new UpstreamTimeoutError("total")),
    timeouts.totalMs,
  );

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      connectTimer = setTimeout(
        () => controller.abort(new UpstreamTimeoutError("connect")),
        timeouts.connectMs,
      );

      let response: Response;
      try {
        // Sequential by necessity: each hop's target depends on the previous
        // hop's redirect Location, so hops can't be parallelized.
        // eslint-disable-next-line no-await-in-loop
        response = await fetchImpl(currentUrl, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify(body),
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) {
          throw controller.signal.reason;
        }
        throw new UpstreamResponseError(
          `Failed to reach chat endpoint: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        clearTimeout(connectTimer);
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new UpstreamSsrfError("Upstream redirected without a Location header");
        }
        let target: URL;
        try {
          target = new URL(location, currentUrl);
        } catch {
          throw new UpstreamSsrfError(`Upstream redirect target is not a valid URL: ${location}`);
        }
        // Re-validate the *target*, not the already-approved source — this is
        // the check a naive `redirect: "follow"` fetch would skip entirely.
        // `assertAllowedEndpoint` throws a plain `Error`; normalize to our
        // typed error so callers (route.ts) classify it as a controlled SSRF
        // rejection rather than an unclassified 500.
        try {
          assertAllowedEndpoint(target.toString(), allowedOrigins, "apiEndpoint");
        } catch (e) {
          throw new UpstreamSsrfError(e instanceof Error ? e.message : String(e));
        }
        currentUrl = target.toString();
        continue;
      }

      // Bound idle time on the body: reset on every chunk (wired by the
      // caller via resetIdle), fire if the upstream goes silent mid-stream.
      idleTimer = setTimeout(
        () => controller.abort(new UpstreamTimeoutError("idle")),
        timeouts.idleMs,
      );
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () => controller.abort(new UpstreamTimeoutError("idle")),
          timeouts.idleMs,
        );
      };

      return { response, resetIdle, dispose };
    }
    throw new UpstreamSsrfError(`Upstream redirected more than ${MAX_REDIRECTS} times`);
  } catch (err) {
    dispose();
    throw err;
  }
}
