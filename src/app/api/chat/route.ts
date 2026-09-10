import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { chatAllowedOrigins } from "@/server/config";
import { db } from "@/server/db";
import { solution } from "@/server/db/schema";
import { getServerAuth, TRPCError, type AuthUser } from "@/server/authz";
import { assertCanRun } from "@/server/features/solution-access";
import { configByTypeSchema, type ChatConfig } from "@/features/solutions/schemas/solution";

import {
  acquireLease,
  loadHandle,
  persistConversationIfUnchanged,
  releaseLease,
} from "@/features/chat/server/conversation-handle";
import {
  GenieUpstreamEventError,
  SseLimitExceededError,
  UpstreamResponseError,
  UpstreamSsrfError,
  UpstreamTimeoutError,
} from "@/features/chat/server/errors";
import { buildGenieRequestBody, toGenieEvents } from "@/features/chat/server/genie-contract";
import {
  CHAT_SEND_LEASE_TTL_MS,
  CHAT_SSE_LIMITS,
  CHAT_UPSTREAM_TIMEOUTS,
} from "@/features/chat/server/limits";
import { readSseDataLines } from "@/features/chat/server/sse-reader";
import { ChatRequestError, readChatRequestBody } from "@/features/chat/server/request-body";
import { mapGenieStreamToUiMessageChunks } from "@/features/chat/server/stream-mapper";
import type { ChatUIMessage } from "@/features/chat/server/ui-message";
import { fetchGenieStream } from "@/features/chat/server/upstream-fetch";
import { sendChatMessageSchema } from "@/features/chat/schemas/chat";

/**
 * `/api/chat` (ticket 13) — proxies the external Genie SSE into an ai-sdk UI
 * message stream. Server-side only; the client (ticket 14) is a plain
 * `useChat` + `DefaultChatTransport` posting `{ solutionId, prompt }`.
 *
 * Guard order: session → bounded body parsing →
 * assertCanRun (grant + not archived + status=ready) → independent type
 * guard (assertCanRun doesn't check type — critique B4) → lease → bounded
 * upstream fetch → stream mapping → generation/config-version-guarded
 * persistence.
 */

class RouteError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

function requireActiveUser(auth: Awaited<ReturnType<typeof getServerAuth>>): AuthUser {
  if (auth.status === "unauthenticated") {
    throw new RouteError(401, "Sign in required");
  }
  if (auth.status === "password-change-required") {
    throw new RouteError(403, "password-change-required");
  }
  return auth.user;
}

function trpcStatusOf(error: TRPCError): number {
  switch (error.code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "UNAUTHORIZED":
      return 401;
    case "BAD_REQUEST":
      return 400;
    default:
      return 500;
  }
}

/** Never leak upstream hostnames/internals to the client — log detail, return a generic message. */
function errorResponse(error: unknown): NextResponse {
  if (error instanceof RouteError || error instanceof ChatRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof TRPCError) {
    return NextResponse.json({ error: error.message }, { status: trpcStatusOf(error) });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (error instanceof UpstreamSsrfError) {
    console.error("[api/chat] SSRF guard rejected upstream target:", error.message);
    return NextResponse.json(
      { error: "Chat endpoint is not configured correctly" },
      { status: 502 },
    );
  }
  if (error instanceof UpstreamTimeoutError) {
    console.error("[api/chat] upstream timeout:", error.kind);
    return NextResponse.json({ error: "The chat service timed out" }, { status: 504 });
  }
  if (error instanceof UpstreamResponseError) {
    console.error("[api/chat] upstream response error:", error.message, error.status);
    return NextResponse.json({ error: "The chat service is unavailable" }, { status: 502 });
  }
  console.error("[api/chat] unexpected error:", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function POST(request: NextRequest): Promise<Response> {
  let leaseHeld: { userId: string; solutionId: string; leaseOwner: string } | null = null;

  try {
    const auth = await getServerAuth(request.headers);
    const user = requireActiveUser(auth);
    const body = sendChatMessageSchema.parse(await readChatRequestBody(request));

    const [row] = await db
      .select({
        id: solution.id,
        type: solution.type,
        status: solution.status,
        archived: solution.archived,
        config: solution.config,
        chatConfigVersion: solution.chatConfigVersion,
      })
      .from(solution)
      .where(eq(solution.id, body.solutionId))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not available" });

    // Two-guard (tech-plan): grant + not archived + not draft + status=ready.
    // Maintenance/Down/Draft never reach the external call.
    await assertCanRun(user, row);

    // Independent type guard (critique B4): assertCanRun never checks type,
    // so a Ready, granted Embedded solution must 400 here, not 500.
    const parsedConfig = configByTypeSchema.safeParse({ type: row.type, config: row.config });
    if (!parsedConfig.success || parsedConfig.data.type !== "chat") {
      throw new RouteError(400, "This solution does not support chat");
    }
    const chatConfig: ChatConfig = parsedConfig.data.config;

    // Send lease (critique B2): serializes concurrent sends per (user, solution).
    const leaseOwner = crypto.randomUUID();
    const acquired = await acquireLease(user.id, row.id, leaseOwner, CHAT_SEND_LEASE_TTL_MS);
    if (!acquired) {
      return NextResponse.json({ error: "already-sending" }, { status: 409 });
    }
    leaseHeld = { userId: user.id, solutionId: row.id, leaseOwner };

    // Read BEFORE the external call — both guards are re-checked at
    // completion against these snapshots (tech-plan → "Conversation model").
    const handle = await loadHandle(user.id, row.id);
    const atGeneration = handle.generation;
    const atChatConfigVersion = row.chatConfigVersion;

    const requestBody = buildGenieRequestBody({
      botUuid: chatConfig.botUuid,
      prompt: body.prompt,
      sessionUuid: handle.externalSessionUuid ?? "",
    });

    const upstream = await fetchGenieStream({
      endpoint: chatConfig.apiEndpoint,
      allowedOrigins: chatAllowedOrigins(),
      body: requestBody,
      clientSignal: request.signal,
      timeouts: CHAT_UPSTREAM_TIMEOUTS,
    });

    const contentType = upstream.response.headers.get("content-type") ?? "";
    if (
      !upstream.response.ok ||
      !contentType.includes("text/event-stream") ||
      !upstream.response.body
    ) {
      upstream.dispose();
      throw new UpstreamResponseError(
        `Unexpected upstream response (status ${upstream.response.status}, content-type "${contentType}")`,
        upstream.response.status,
      );
    }

    const lease = leaseHeld;
    const stream = createUIMessageStream<ChatUIMessage>({
      execute: async ({ writer }) => {
        try {
          writer.write({ type: "start" });
          const lines = readSseDataLines(
            upstream.response.body!,
            CHAT_SSE_LIMITS,
            upstream.resetIdle,
          );
          const outcome = await mapGenieStreamToUiMessageChunks(toGenieEvents(lines), writer);
          await persistConversationIfUnchanged({
            userId: lease.userId,
            solutionId: lease.solutionId,
            externalSessionUuid: outcome.conversationUuid,
            atGeneration,
            atChatConfigVersion,
          });
        } finally {
          upstream.dispose();
          await releaseLease(lease.userId, lease.solutionId, lease.leaseOwner);
        }
      },
      onError: (error) => {
        console.error(
          "[api/chat] stream error:",
          error instanceof Error ? error.message : error,
          error instanceof SseLimitExceededError ? `(${error.kind})` : "",
          error instanceof GenieUpstreamEventError ? "(genie event)" : "",
        );
        return "The chat service returned an unexpected response.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (leaseHeld) {
      await releaseLease(leaseHeld.userId, leaseHeld.solutionId, leaseHeld.leaseOwner);
    }
    return errorResponse(error);
  }
}
