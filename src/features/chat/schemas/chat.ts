import { z } from "zod";

/**
 * `/api/chat` request body (ticket 13). The client's `DefaultChatTransport.
 * prepareSendMessagesRequest` (ticket 14) sends this shape — not ai-sdk's
 * default `{ messages }` — because the external Genie API wants a plain
 * `userPrompt` string, not the ai-sdk `parts` structure.
 *
 * `prompt` has a hard max length (tech-plan → "Bounded fetch"): an admin-
 * configured downstream endpoint can't be handed unbounded input via the one
 * knob the client controls.
 */
export const sendChatMessageSchema = z.object({
  solutionId: z.uuid(),
  prompt: z.string().trim().min(1, "Enter a message").max(8_000, "Keep it under 8000 characters"),
});
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

export const newChatSchema = z.object({
  solutionId: z.uuid(),
});
