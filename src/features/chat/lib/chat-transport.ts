import { DefaultChatTransport, type ChatTransport, type UIMessageChunk } from "ai";

import type { ChatUIMessage } from "@/features/chat/server/ui-message";

export function lastTextPart(message: ChatUIMessage | undefined): string {
  if (!message) return "";
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (part.type === "text") return part.text;
  }
  return "";
}

export function createChatTransport(solutionId: string): ChatTransport<ChatUIMessage> {
  const transport = new DefaultChatTransport<ChatUIMessage>({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { solutionId, prompt: lastTextPart(messages.at(-1)) },
    }),
  });

  return {
    async sendMessages(options) {
      const stream = await transport.sendMessages(options);
      let finished = false;

      return stream.pipeThrough(
        new TransformStream<UIMessageChunk, UIMessageChunk>({
          transform(chunk, controller) {
            if (chunk.type === "finish") finished = true;
            controller.enqueue(chunk);
          },
          flush() {
            // A clean HTTP EOF can still truncate an answer. The SDK otherwise
            // treats it as success even without our server's finish chunk.
            if (!finished) throw new Error("Chat response interrupted.");
          },
        }),
      );
    },
    reconnectToStream: (options) => transport.reconnectToStream(options),
  };
}
