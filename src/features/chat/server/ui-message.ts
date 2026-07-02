import type { InferUIMessageChunk, UIMessage } from "ai";

/**
 * Custom UI message metadata for chat solutions — carries `outputTokens` from
 * the external Genie `completed` event.
 *
 * SDK spike (ai@7.0.11, ticket 13): the `finish` chunk has no dedicated
 * `usage` field (unlike `streamText`'s LLM-provider usage) — only
 * `finishReason` and a generic `messageMetadata`. `messageMetadata` on
 * `start`/`finish`/`message-metadata` chunks IS merged into the resulting
 * `UIMessage.metadata` by the client-side stream processor (verified in
 * `ai`'s `processUIMessageStream`), so it's the idiomatic, fully-supported
 * carrier for exactly this kind of non-content data — cleaner than inventing
 * a bespoke `data-usage` part. Ticket 14 reads `message.metadata?.outputTokens`.
 *
 * `reasoning-start`/`reasoning-delta`/`reasoning-end` chunk types ARE
 * first-class in this SDK version (confirmed against the installed
 * `ai/dist/index.d.ts`), so no `data-reasoning` fallback is needed either.
 */
export type ChatUIMessageMetadata = { outputTokens?: number };
export type ChatUIMessage = UIMessage<ChatUIMessageMetadata>;
export type ChatUIMessageChunk = InferUIMessageChunk<ChatUIMessage>;
