import { GenieUpstreamEventError } from "./errors";
import { GENIE_STATUS, type GenieEvent } from "./genie-contract";
import type { ChatUIMessageChunk } from "./ui-message";

/**
 * Maps the external Genie SSE event sequence onto ai-sdk UI message chunks
 * (tech-plan → "Server: SSE → ai-sdk UI message stream"). Pure and
 * network/DB-free so it's unit-testable: takes an async iterable of already-
 * parsed {@link GenieEvent}s and a minimal writer, returns the conversation
 * id + usage once `completed` is reached.
 *
 * `ChatChunkWriter` is a structural subset of ai-sdk's `UIMessageStreamWriter`
 * (just `write`) so tests don't need to construct a real stream.
 */
export interface ChatChunkWriter {
  write(chunk: ChatUIMessageChunk): void;
}

export type ChatStreamOutcome = {
  conversationUuid: string;
  outputTokens: number;
};

export async function mapGenieStreamToUiMessageChunks(
  events: AsyncIterable<GenieEvent>,
  writer: ChatChunkWriter,
  generateId: () => string = () => crypto.randomUUID(),
): Promise<ChatStreamOutcome> {
  let textId: string | undefined;
  let reasoningId: string | undefined;
  let textOpen = false;
  let reasoningOpen = false;
  // Tracks what's been emitted so far, for the "cumulative vs incremental"
  // reasoning heuristic (contract: only ever observed as one block, but "if a
  // new value is a prefix-superset of the prior treat as cumulative, else
  // append" — handled generically in case it ever streams multi-chunk).
  let reasoningEmitted = "";
  let conversationUuid: string | undefined;

  const closeReasoning = () => {
    if (reasoningOpen) {
      writer.write({ type: "reasoning-end", id: reasoningId! });
      reasoningOpen = false;
    }
  };
  const closeText = () => {
    if (textOpen) {
      writer.write({ type: "text-end", id: textId! });
      textOpen = false;
    }
  };

  for await (const event of events) {
    if (event.uuid) conversationUuid = event.uuid;

    // Unverified error shape (tech-plan "open items"): treat any populated
    // errorMessage as terminal, whatever the accompanying status.
    if (event.errorMessage) {
      throw new GenieUpstreamEventError(event.errorMessage);
    }

    if (event.status === GENIE_STATUS.completed) {
      closeText();
      closeReasoning();
      if (!conversationUuid) {
        throw new GenieUpstreamEventError("Upstream completed without a conversation id");
      }
      const outputTokens = event.outputTokens;
      writer.write({ type: "finish", messageMetadata: { outputTokens } });
      return { conversationUuid, outputTokens };
    }

    if (event.status !== GENIE_STATUS.processing && event.status !== GENIE_STATUS.initiating) {
      throw new GenieUpstreamEventError(`Unexpected upstream status: "${event.status}"`);
    }

    if (event.reasoning) {
      if (!reasoningOpen) {
        reasoningId = generateId();
        writer.write({ type: "reasoning-start", id: reasoningId });
        reasoningOpen = true;
        writer.write({ type: "reasoning-delta", id: reasoningId, delta: event.reasoning });
        reasoningEmitted = event.reasoning;
      } else if (event.reasoning.startsWith(reasoningEmitted)) {
        const delta = event.reasoning.slice(reasoningEmitted.length);
        if (delta) writer.write({ type: "reasoning-delta", id: reasoningId!, delta });
        reasoningEmitted = event.reasoning;
      } else {
        writer.write({ type: "reasoning-delta", id: reasoningId!, delta: event.reasoning });
        reasoningEmitted += event.reasoning;
      }
    }

    if (event.answer) {
      // The thinking block collapses once the answer begins (tech-plan →
      // "the thinking block").
      closeReasoning();
      if (!textOpen) {
        textId = generateId();
        writer.write({ type: "text-start", id: textId });
        textOpen = true;
      }
      writer.write({ type: "text-delta", id: textId!, delta: event.answer });
    }
  }

  throw new GenieUpstreamEventError("Upstream stream ended before a completed event");
}
