import { Chat } from "@ai-sdk/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage, ChatUIMessageChunk } from "@/features/chat/server/ui-message";

import { createChatTransport } from "./chat-transport";

function response(chunks: ChatUIMessageChunk[]) {
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

const partial: ChatUIMessageChunk[] = [
  { type: "start", messageId: "answer" },
  { type: "text-start", id: "text" },
  { type: "text-delta", id: "text", delta: "Unfinished answer" },
];
const complete: ChatUIMessageChunk[] = [
  { type: "start", messageId: "answer-complete" },
  { type: "text-start", id: "text" },
  { type: "text-delta", id: "text", delta: "Complete answer" },
  { type: "text-end", id: "text" },
  { type: "finish", messageMetadata: { outputTokens: 2 } },
];

afterEach(() => vi.unstubAllGlobals());

describe("chat transport recovery", () => {
  it("retries failed HTTP requests without adding duplicate user turns", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("private server detail", { status: 502 }))
      .mockResolvedValueOnce(new Response("already-sending", { status: 409 }))
      .mockResolvedValueOnce(response(complete));
    vi.stubGlobal("fetch", fetch);
    const chat = new Chat<ChatUIMessage>({ transport: createChatTransport("solution") });

    await chat.sendMessage({ text: "My question" });
    expect(chat.status).toBe("error");
    const userId = chat.messages[0].id;
    await chat.regenerate();
    expect(chat.status).toBe("error");
    expect(chat.messages).toHaveLength(1);
    await chat.regenerate();

    expect(chat.status).toBe("ready");
    expect(chat.error).toBeUndefined();
    expect(chat.messages.map(({ role }) => role)).toEqual(["user", "assistant"]);
    expect(chat.messages[0].id).toBe(userId);
    expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual([
      { solutionId: "solution", prompt: "My question" },
      { solutionId: "solution", prompt: "My question" },
      { solutionId: "solution", prompt: "My question" },
    ]);
  });

  it.each(["error chunk", "clean EOF"])(
    "marks a partial response interrupted after %s and replaces it on retry",
    async (failure) => {
      const chunks = [...partial];
      if (failure === "error chunk") {
        chunks.push({ type: "error", errorText: "private upstream detail" });
      }
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(response(chunks))
        .mockResolvedValueOnce(response(complete));
      vi.stubGlobal("fetch", fetch);
      const chat = new Chat<ChatUIMessage>({ transport: createChatTransport("solution") });

      await chat.sendMessage({ text: "My question" });
      expect(chat.status).toBe("error");
      expect(chat.messages.at(-1)?.parts).toContainEqual({
        type: "text",
        text: "Unfinished answer",
        state: "streaming",
      });
      await chat.regenerate();

      expect(chat.status).toBe("ready");
      expect(chat.messages.map(({ role }) => role)).toEqual(["user", "assistant"]);
      expect(JSON.stringify(chat.messages)).not.toContain("Unfinished answer");
      expect(JSON.parse(fetch.mock.calls[1][1].body).prompt).toBe("My question");
    },
  );

  it("keeps completed turns when a later request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(complete))
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );
    const chat = new Chat<ChatUIMessage>({ transport: createChatTransport("solution") });
    await chat.sendMessage({ text: "First question" });
    const firstTurn = structuredClone(chat.messages);
    await chat.sendMessage({ text: "Second question" });

    expect(chat.status).toBe("error");
    expect(chat.messages.slice(0, 2)).toEqual(firstTurn);
    expect(chat.messages.at(-1)?.role).toBe("user");
  });
});
