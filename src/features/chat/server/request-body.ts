export const CHAT_MAX_REQUEST_BYTES = 1024 * 1024;

export class ChatRequestError extends Error {
  constructor(
    public readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

export async function readChatRequestBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > CHAT_MAX_REQUEST_BYTES) {
    throw new ChatRequestError(413, "Request body too large");
  }
  if (!request.body) throw new ChatRequestError(400, "Invalid JSON body");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      // Each read advances the same stream.
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > CHAT_MAX_REQUEST_BYTES) {
        void reader.cancel().catch((error: unknown) => {
          console.error("[api/chat] request cancellation failed:", error);
        });
        throw new ChatRequestError(413, "Request body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ChatRequestError(400, "Invalid JSON body");
  }
}
