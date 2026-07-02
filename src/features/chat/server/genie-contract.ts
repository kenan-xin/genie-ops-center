import { z } from "zod";

import { GenieUpstreamEventError } from "./errors";

/**
 * The external Genie chat API's observed contract (docs/external-chat-api-
 * contract). Types + a defensive zod schema for the untrusted SSE payload —
 * an admin-configured endpoint is trusted for *origin* (allow-list) but not
 * for well-formed output, so every event is parsed, not cast.
 */

export type GenieChatRequestBody = {
  uuid: string; // bot id (solution.config.botUuid)
  userPrompt: string;
  sessionUUID: string; // "" starts a new external conversation
  language: string;
  documentIDs: string[];
  imageIDs: string[];
  audioIDs: string[];
  customFields: Record<string, never>;
};

/** BCP-47; hardcoded until the app has a locale feature. */
export const GENIE_DEFAULT_LANGUAGE = "en-US";

export function buildGenieRequestBody(params: {
  botUuid: string;
  prompt: string;
  sessionUuid: string;
}): GenieChatRequestBody {
  return {
    uuid: params.botUuid,
    userPrompt: params.prompt,
    sessionUUID: params.sessionUuid,
    language: GENIE_DEFAULT_LANGUAGE,
    documentIDs: [],
    imageIDs: [],
    audioIDs: [],
    customFields: {},
  };
}

/**
 * One `data:` event. `.loose()` tolerates fields we don't map (`nodeInfos`,
 * `title`, `intents`, `TokenBreakdown`, ...) — we only need the few that
 * drive the ai-sdk stream. Every optional text field defaults to "" so the
 * mapper never has to null-check.
 */
export const genieEventSchema = z
  .object({
    uuid: z.string().default(""),
    status: z.string(),
    answer: z.string().optional().default(""),
    reasoning: z.string().optional().default(""),
    outputTokens: z.number().optional().default(0),
    errorMessage: z.string().optional().default(""),
  })
  .loose();

export type GenieEvent = z.infer<typeof genieEventSchema>;

export const GENIE_STATUS = {
  initiating: "initiating",
  processing: "processing",
  completed: "completed",
} as const;

/** Parse one raw SSE `data:` payload into a {@link GenieEvent}, or throw a controlled error. */
export function parseGenieEventLine(raw: string): GenieEvent {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new GenieUpstreamEventError("Upstream sent a malformed SSE event (invalid JSON)");
  }
  const parsed = genieEventSchema.safeParse(json);
  if (!parsed.success) {
    throw new GenieUpstreamEventError("Upstream sent an SSE event that doesn't match the contract");
  }
  return parsed.data;
}

/** Adapts the raw SSE line generator into a `GenieEvent` async iterable. */
export async function* toGenieEvents(lines: AsyncIterable<string>): AsyncGenerator<GenieEvent> {
  for await (const line of lines) {
    yield parseGenieEventLine(line);
  }
}
