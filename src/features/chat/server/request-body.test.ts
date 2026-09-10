import { describe, expect, it, vi } from "vitest";

import { CHAT_MAX_REQUEST_BYTES, readChatRequestBody } from "./request-body";

function streamedRequest(chunks: Uint8Array[], headers?: HeadersInit) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
    },
    cancel,
  });
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);
  return { request, cancel };
}

describe("readChatRequestBody", () => {
  it("accepts JSON exactly at the byte limit", async () => {
    const value = "a".repeat(CHAT_MAX_REQUEST_BYTES - 2);
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify(value),
    });
    await expect(readChatRequestBody(request)).resolves.toBe(value);
  });

  it("rejects an oversized Content-Length without reading", async () => {
    const { request } = streamedRequest([], {
      "content-length": String(CHAT_MAX_REQUEST_BYTES + 1),
    });
    const getReader = vi.spyOn(request.body!, "getReader");
    await expect(readChatRequestBody(request)).rejects.toMatchObject({ status: 413 });
    expect(getReader).not.toHaveBeenCalled();
  });

  it.each([undefined, { "content-length": "1" }])(
    "counts streamed bytes independently of the declared length (%j)",
    async (headers) => {
      const { request, cancel } = streamedRequest(
        [new Uint8Array(CHAT_MAX_REQUEST_BYTES), new Uint8Array(1)],
        headers,
      );
      await expect(readChatRequestBody(request)).rejects.toMatchObject({ status: 413 });
      expect(cancel).toHaveBeenCalledOnce();
      expect(request.body!.locked).toBe(false);
    },
  );

  it("decodes UTF-8 characters split across chunks", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify({ prompt: "你好" }));
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          for (const byte of encoded) controller.enqueue(Uint8Array.of(byte));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    await expect(readChatRequestBody(request)).resolves.toEqual({ prompt: "你好" });
  });

  it.each(["{", ""])("returns 400 for invalid JSON (%j)", async (body) => {
    await expect(
      readChatRequestBody(new Request("http://localhost/api/chat", { method: "POST", body })),
    ).rejects.toMatchObject({ status: 400 });
  });
});
