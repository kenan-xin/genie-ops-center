/**
 * Every controlled failure mode the chat proxy can hit, in one place so
 * `route.ts` has a single import for its error → HTTP-status mapping
 * (tech-plan → "never a 500" / "controlled error").
 */

export type UpstreamTimeoutKind = "connect" | "idle" | "total" | "client-disconnect";

export class UpstreamTimeoutError extends Error {
  constructor(public readonly kind: UpstreamTimeoutKind) {
    super(`Upstream request aborted: ${kind}`);
    this.name = "UpstreamTimeoutError";
  }
}

/** A redirect target failed the origin allow-list, or had no/invalid Location. */
export class UpstreamSsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamSsrfError";
  }
}

/** Non-2xx status, wrong content-type, or the fetch itself failed. */
export class UpstreamResponseError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamResponseError";
  }
}

/** Malformed SSE framing/JSON, an `errorMessage` event, or an unexpected `status`. */
export class GenieUpstreamEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenieUpstreamEventError";
  }
}

export class SseLimitExceededError extends Error {
  constructor(
    public readonly kind: "line" | "total" | "events",
    message: string,
  ) {
    super(message);
    this.name = "SseLimitExceededError";
  }
}
