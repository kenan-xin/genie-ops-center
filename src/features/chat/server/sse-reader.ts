import { SseLimitExceededError } from "./errors";

export type SseLimits = {
  maxLineBytes: number;
  maxTotalBytes: number;
  maxEvents: number;
};

/**
 * Parse `data: {json}\n\n` SSE framing into raw JSON text, enforcing byte/
 * event caps (tech-plan → "Bounded fetch"): a hung-open or misbehaving
 * admin-configured endpoint can't pin memory by never closing the stream.
 * The observed contract has no `event:` types and no `[DONE]` sentinel —
 * every meaningful line starts with `data:`.
 *
 * `onChunk` fires once per underlying stream read (drives the caller's
 * idle-timeout reset), independent of how many complete lines that read
 * produces.
 */
export async function* readSseDataLines(
  body: ReadableStream<Uint8Array>,
  limits: SseLimits,
  onChunk?: () => void,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalBytes = 0;
  let eventCount = 0;
  try {
    for (;;) {
      // Sequential by necessity: each read depends on the stream's current
      // position, so there's nothing to parallelize.
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      onChunk?.();
      totalBytes += value.byteLength;
      if (totalBytes > limits.maxTotalBytes) {
        throw new SseLimitExceededError(
          "total",
          `Upstream response exceeded ${limits.maxTotalBytes} bytes`,
        );
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (Buffer.byteLength(line, "utf8") > limits.maxLineBytes) {
          throw new SseLimitExceededError(
            "line",
            `Upstream event line exceeded ${limits.maxLineBytes} bytes`,
          );
        }
        if (line.startsWith("data:")) {
          eventCount += 1;
          if (eventCount > limits.maxEvents) {
            throw new SseLimitExceededError(
              "events",
              `Upstream sent more than ${limits.maxEvents} events`,
            );
          }
          yield line.slice(5).trim();
        }
        newlineIndex = buffer.indexOf("\n");
      }
      // No newline in the buffer: a single unterminated `data:` line can grow
      // past `maxLineBytes` toward `maxTotalBytes` (review P3-A). Bound it the
      // same way a terminated line would be — the trailing segment is exactly
      // the line-in-progress.
      if (newlineIndex === -1 && Buffer.byteLength(buffer, "utf8") > limits.maxLineBytes) {
        throw new SseLimitExceededError(
          "line",
          `Upstream event line exceeded ${limits.maxLineBytes} bytes`,
        );
      }
    }
  } finally {
    reader.releaseLock();
  }
}
