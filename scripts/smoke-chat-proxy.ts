/**
 * Smoke check for ticket 13 (chat streaming proxy) invariants. Run against a
 * migrated DB:
 *   DATABASE_URL=postgres://genie:genie@localhost:5432/genie \
 *   BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
 *   PUBLIC_BASE_URL=http://localhost:3000 \
 *   GENIE_CHAT_API_ALLOWED_ORIGINS=https://good.example.com \
 *   pnpm dlx tsx scripts/smoke-chat-proxy.ts
 *
 * Not a test framework — one file, asserts, exits non-zero on the first
 * category of failures (matches scripts/smoke-identity.ts). Creates its own
 * user/group/solution fixtures (randomly-suffixed, cleaned up in `finally`)
 * so it's safe to run against the shared dev DB.
 *
 * Covers the critique invariants ticket 13 lists explicitly:
 *  [1] stream-mapper: one-block reasoning + text assembly, finish/usage
 *  [2] stream-mapper: errorMessage / unexpected status -> controlled error
 *  [3] sse-reader: line/total/event caps
 *  [4] genie-contract: malformed JSON / schema-invalid event -> controlled error
 *  [5] url-guard: IPv4-mapped-IPv6 SSRF + off-allow-list rejection
 *  [6] upstream-fetch: redirect-to-allowed followed, redirect-to-disallowed
 *      rejected, redirect-loop bounded, connect/total/client-disconnect timeouts
 *  [7] conversation-handle: generation-guard (New chat mid-stream)
 *  [8] conversation-handle: config-version guard, incl. no-handle-row-yet
 *  [9] conversation-handle: lease expired-takeover, old-finally-doesn't-clear-newer,
 *      true concurrent-send race
 *  [10] route: type-guard (Ready, granted Embedded solution -> 400, not 500)
 */
import { eq, sql } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { group, groupMember, groupSolution, solution, chatSessionHandle } from "@/server/db/schema";
import { assertAllowedEndpoint, isPrivateHost } from "@/lib/url-guard";

import {
  acquireLease,
  loadHandle,
  persistConversationIfUnchanged,
  releaseLease,
  resetChatSession,
} from "@/features/chat/server/conversation-handle";
import {
  GenieUpstreamEventError,
  SseLimitExceededError,
  UpstreamSsrfError,
  UpstreamTimeoutError,
} from "@/features/chat/server/errors";
import {
  GENIE_STATUS,
  parseGenieEventLine,
  toGenieEvents,
  type GenieEvent,
} from "@/features/chat/server/genie-contract";
import { readSseDataLines } from "@/features/chat/server/sse-reader";
import {
  mapGenieStreamToUiMessageChunks,
  type ChatChunkWriter,
} from "@/features/chat/server/stream-mapper";
import type { ChatUIMessageChunk } from "@/features/chat/server/ui-message";
import { fetchGenieStream } from "@/features/chat/server/upstream-fetch";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.info(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

function collectingWriter(): { writer: ChatChunkWriter; chunks: ChatUIMessageChunk[] } {
  const chunks: ChatUIMessageChunk[] = [];
  return { writer: { write: (c) => chunks.push(c) }, chunks };
}

async function* asyncOf<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

function fakeEvent(partial: Partial<GenieEvent> & { status: string }): GenieEvent {
  return { uuid: "", answer: "", reasoning: "", outputTokens: 0, errorMessage: "", ...partial };
}

function encodeChunks(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

async function main() {
  console.info("\n[1] stream-mapper: one-block reasoning + text assembly, finish/usage");
  {
    const { writer, chunks } = collectingWriter();
    const events = asyncOf<GenieEvent>([
      fakeEvent({ status: GENIE_STATUS.processing, reasoning: "Thinking about it..." }),
      fakeEvent({ status: GENIE_STATUS.processing, answer: "Hello" }),
      fakeEvent({ status: GENIE_STATUS.processing, answer: " world" }),
      fakeEvent({
        status: GENIE_STATUS.completed,
        uuid: "conv-1",
        answer: "Hello world",
        reasoning: "Thinking about it...",
        outputTokens: 42,
      }),
    ]);
    const outcome = await mapGenieStreamToUiMessageChunks(events, writer);
    check("returns the conversation uuid", outcome.conversationUuid === "conv-1");
    check("returns outputTokens", outcome.outputTokens === 42);
    const reasoningStarts = chunks.filter((c) => c.type === "reasoning-start");
    const reasoningEnds = chunks.filter((c) => c.type === "reasoning-end");
    const textStarts = chunks.filter((c) => c.type === "text-start");
    const textEnds = chunks.filter((c) => c.type === "text-end");
    check(
      "exactly one reasoning-start",
      reasoningStarts.length === 1,
      `got ${reasoningStarts.length}`,
    );
    check("exactly one reasoning-end", reasoningEnds.length === 1, `got ${reasoningEnds.length}`);
    check("exactly one text-start", textStarts.length === 1, `got ${textStarts.length}`);
    check("exactly one text-end", textEnds.length === 1, `got ${textEnds.length}`);
    const textDeltas = chunks.filter((c) => c.type === "text-delta").map((c: any) => c.delta);
    check(
      "text deltas as-is, no re-emit of completed's full answer",
      textDeltas.join("") === "Hello world",
      textDeltas.join("|"),
    );
    const reasoningDeltas = chunks
      .filter((c) => c.type === "reasoning-delta")
      .map((c: any) => c.delta);
    check(
      "reasoning delta emitted once, not re-emitted at completed",
      reasoningDeltas.join("") === "Thinking about it...",
      reasoningDeltas.join("|"),
    );
    const finish = chunks.find((c) => c.type === "finish") as any;
    check(
      "finish carries outputTokens via messageMetadata",
      finish?.messageMetadata?.outputTokens === 42,
    );
    // reasoning-end must land before text-start (thinking block collapses when the answer begins).
    const reasoningEndIdx = chunks.findIndex((c) => c.type === "reasoning-end");
    const textStartIdx = chunks.findIndex((c) => c.type === "text-start");
    check("reasoning collapses before the answer begins", reasoningEndIdx < textStartIdx);
  }

  console.info(
    "\n[2] stream-mapper: errorMessage / unexpected status -> controlled error, no persistence reachable",
  );
  {
    const { writer } = collectingWriter();
    let threw = false;
    try {
      await mapGenieStreamToUiMessageChunks(
        asyncOf<GenieEvent>([
          fakeEvent({ status: GENIE_STATUS.processing, errorMessage: "bot exploded" }),
        ]),
        writer,
      );
    } catch (e) {
      threw = e instanceof GenieUpstreamEventError && e.message === "bot exploded";
    }
    check("errorMessage event throws GenieUpstreamEventError", threw);

    let threw2 = false;
    try {
      await mapGenieStreamToUiMessageChunks(
        asyncOf<GenieEvent>([fakeEvent({ status: "weird-status" })]),
        writer,
      );
    } catch (e) {
      threw2 = e instanceof GenieUpstreamEventError;
    }
    check("unexpected status throws GenieUpstreamEventError", threw2);

    let threw3 = false;
    try {
      await mapGenieStreamToUiMessageChunks(asyncOf<GenieEvent>([]), writer);
    } catch (e) {
      threw3 = e instanceof GenieUpstreamEventError;
    }
    check("stream ending without completed throws GenieUpstreamEventError", threw3);
  }

  console.info("\n[3] sse-reader: line/total/event caps");
  {
    const lines = await drain(
      readSseDataLines(encodeChunks(['data: {"a":1}\n\n', 'data: {"a":2}\n', ": keep-alive\n"]), {
        maxLineBytes: 1_000,
        maxTotalBytes: 1_000_000,
        maxEvents: 1_000,
      }),
    );
    check(
      "parses data lines, ignores non-data lines",
      lines.length === 2,
      `got ${JSON.stringify(lines)}`,
    );
    check("strips the 'data:' prefix", lines[0] === '{"a":1}', lines[0]);

    let lineCapThrew = false;
    try {
      await drain(
        readSseDataLines(encodeChunks(["data: " + "x".repeat(50) + "\n"]), {
          maxLineBytes: 10,
          maxTotalBytes: 1_000_000,
          maxEvents: 1_000,
        }),
      );
    } catch (e) {
      lineCapThrew = e instanceof SseLimitExceededError && e.kind === "line";
    }
    check("oversized line throws SseLimitExceededError(line)", lineCapThrew);

    let eventCapThrew = false;
    try {
      await drain(
        readSseDataLines(encodeChunks(["data: 1\ndata: 2\ndata: 3\n"]), {
          maxLineBytes: 1_000,
          maxTotalBytes: 1_000_000,
          maxEvents: 2,
        }),
      );
    } catch (e) {
      eventCapThrew = e instanceof SseLimitExceededError && e.kind === "events";
    }
    check("too many events throws SseLimitExceededError(events)", eventCapThrew);

    let totalCapThrew = false;
    try {
      await drain(
        readSseDataLines(encodeChunks(["data: " + "x".repeat(100) + "\n"]), {
          maxLineBytes: 1_000,
          maxTotalBytes: 10,
          maxEvents: 1_000,
        }),
      );
    } catch (e) {
      totalCapThrew = e instanceof SseLimitExceededError && e.kind === "total";
    }
    check("oversized total throws SseLimitExceededError(total)", totalCapThrew);
  }

  console.info("\n[4] genie-contract: malformed JSON / schema-invalid event -> controlled error");
  {
    let threw = false;
    try {
      parseGenieEventLine("not json");
    } catch (e) {
      threw = e instanceof GenieUpstreamEventError;
    }
    check("invalid JSON throws GenieUpstreamEventError", threw);

    let threw2 = false;
    try {
      parseGenieEventLine(JSON.stringify({ status: 123 }));
    } catch (e) {
      threw2 = e instanceof GenieUpstreamEventError;
    }
    check("schema-invalid event (status not a string) throws GenieUpstreamEventError", threw2);

    const parsed = parseGenieEventLine(JSON.stringify({ status: "processing" }));
    check(
      "missing optional fields default to empty/zero",
      parsed.answer === "" && parsed.reasoning === "" && parsed.outputTokens === 0,
    );

    const events = await drain(toGenieEvents(asyncOf(['{"status":"processing","answer":"hi"}'])));
    check("toGenieEvents adapts raw lines to GenieEvent", events[0]?.answer === "hi");
  }

  console.info("\n[5] url-guard: IPv4-mapped-IPv6 SSRF + off-allow-list rejection");
  {
    check("IPv4-mapped-IPv6 cloud metadata is private", isPrivateHost("::ffff:169.254.169.254"));
    check("IPv4-mapped-IPv6 public IP is not private", !isPrivateHost("::ffff:8.8.8.8"));
    check("bare cloud metadata IP is private", isPrivateHost("169.254.169.254"));

    let mappedRejected = false;
    try {
      assertAllowedEndpoint("https://[::ffff:169.254.169.254]/x", ["https://good.example.com"]);
    } catch {
      mappedRejected = true;
    }
    check(
      "IPv4-mapped-IPv6 target rejected even off an approved-looking allow-list",
      mappedRejected,
    );

    let offListRejected = false;
    try {
      assertAllowedEndpoint("https://evil.example.com/x", ["https://good.example.com"]);
    } catch {
      offListRejected = true;
    }
    check("off-allow-list origin rejected", offListRejected);

    let onListAccepted = true;
    try {
      assertAllowedEndpoint("https://good.example.com/x", ["https://good.example.com"]);
    } catch {
      onListAccepted = false;
    }
    check("on-allow-list origin accepted", onListAccepted);
  }

  console.info("\n[6] upstream-fetch: redirects, timeouts, client-disconnect");
  {
    const allowed = ["https://good.example.com"];
    const jsonBody = {
      uuid: "b",
      userPrompt: "p",
      sessionUUID: "",
      language: "en-US",
      documentIDs: [],
      imageIDs: [],
      audioIDs: [],
      customFields: {},
    };

    // redirect to an off-allow-list target -> rejected, not followed
    let calls = 0;
    let ssrfThrew = false;
    const redirectToEvil = (async (_url: string) => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.com/x" },
      });
    }) as unknown as typeof fetch;
    try {
      await fetchGenieStream({
        endpoint: "https://good.example.com/chat",
        allowedOrigins: allowed,
        body: jsonBody,
        clientSignal: new AbortController().signal,
        timeouts: { connectMs: 1_000, idleMs: 1_000, totalMs: 1_000 },
        fetchImpl: redirectToEvil,
      });
    } catch (e) {
      ssrfThrew = e instanceof UpstreamSsrfError;
    }
    check(
      "redirect to off-allow-list target rejected, not followed",
      ssrfThrew && calls === 1,
      `calls=${calls}`,
    );

    // redirect to an allow-listed target -> followed
    let followCalls: string[] = [];
    const redirectThenOk = (async (url: string) => {
      followCalls.push(url);
      if (followCalls.length === 1) {
        return new Response(null, {
          status: 307,
          headers: { location: "https://good.example.com/moved" },
        });
      }
      return new Response("data: {}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;
    const followed = await fetchGenieStream({
      endpoint: "https://good.example.com/chat",
      allowedOrigins: allowed,
      body: jsonBody,
      clientSignal: new AbortController().signal,
      timeouts: { connectMs: 1_000, idleMs: 1_000, totalMs: 1_000 },
      fetchImpl: redirectThenOk,
    });
    followed.dispose();
    check(
      "redirect to allow-listed target is followed",
      followCalls.length === 2 && followCalls[1] === "https://good.example.com/moved",
      JSON.stringify(followCalls),
    );
    check("followed response is ok", followed.response.status === 200);

    // redirect loop exceeding the bound
    let loopCalls = 0;
    let loopThrew = false;
    const alwaysRedirect = (async () => {
      loopCalls++;
      return new Response(null, {
        status: 302,
        headers: { location: "https://good.example.com/again" },
      });
    }) as unknown as typeof fetch;
    try {
      await fetchGenieStream({
        endpoint: "https://good.example.com/chat",
        allowedOrigins: allowed,
        body: jsonBody,
        clientSignal: new AbortController().signal,
        timeouts: { connectMs: 1_000, idleMs: 1_000, totalMs: 1_000 },
        fetchImpl: alwaysRedirect,
      });
    } catch (e) {
      loopThrew = e instanceof UpstreamSsrfError;
    }
    check("redirect loop is bounded", loopThrew && loopCalls === 4, `calls=${loopCalls}`);

    // connect timeout: fetch hangs until aborted
    const hangingFetch = (async (_url: string, opts: any) => {
      return new Promise<Response>((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(opts.signal.reason));
      });
    }) as unknown as typeof fetch;
    let connectTimedOut = false;
    const connectStart = Date.now();
    try {
      await fetchGenieStream({
        endpoint: "https://good.example.com/chat",
        allowedOrigins: allowed,
        body: jsonBody,
        clientSignal: new AbortController().signal,
        timeouts: { connectMs: 40, idleMs: 10_000, totalMs: 10_000 },
        fetchImpl: hangingFetch,
      });
    } catch (e) {
      connectTimedOut = e instanceof UpstreamTimeoutError && e.kind === "connect";
    }
    check(
      "connect timeout fires and is classified as 'connect'",
      connectTimedOut && Date.now() - connectStart < 2_000,
    );

    // total timeout fires before a much larger connect timeout
    let totalTimedOut = false;
    try {
      await fetchGenieStream({
        endpoint: "https://good.example.com/chat",
        allowedOrigins: allowed,
        body: jsonBody,
        clientSignal: new AbortController().signal,
        timeouts: { connectMs: 10_000, idleMs: 10_000, totalMs: 40 },
        fetchImpl: hangingFetch,
      });
    } catch (e) {
      totalTimedOut = e instanceof UpstreamTimeoutError && e.kind === "total";
    }
    check("total timeout fires independently of a longer connect timeout", totalTimedOut);

    // client disconnect propagates
    const clientController = new AbortController();
    let disconnectThrew = false;
    const neverRespond = hangingFetch;
    const p = fetchGenieStream({
      endpoint: "https://good.example.com/chat",
      allowedOrigins: allowed,
      body: jsonBody,
      clientSignal: clientController.signal,
      timeouts: { connectMs: 10_000, idleMs: 10_000, totalMs: 10_000 },
      fetchImpl: neverRespond,
    });
    setTimeout(() => clientController.abort(), 20);
    try {
      await p;
    } catch (e) {
      disconnectThrew = e instanceof UpstreamTimeoutError && e.kind === "client-disconnect";
    }
    check("client disconnect aborts the upstream fetch", disconnectThrew);
  }

  // ── DB-backed fixtures ──────────────────────────────────────────────────
  const suffix = crypto.randomUUID().slice(0, 8);
  const testEmail = `chat-proxy-${suffix}@example.com`;
  const testPassword = "Sup3rSecret!pw1";
  const createdSolutionIds: string[] = [];
  const createdGroupIds: string[] = [];
  let testUserId: string | null = null;

  try {
    const signUpResult = await auth.api.signUpEmail({
      body: { email: testEmail, password: testPassword, name: "Chat Proxy Test" },
    });
    testUserId = signUpResult.user.id;

    console.info(
      "\n[7] conversation-handle: generation-guard (New chat mid-stream can't be resurrected)",
    );
    {
      const [s] = await db
        .insert(solution)
        .values({
          name: `chat-proxy-gen-${suffix}`,
          slug: `chat-proxy-gen-${suffix}`,
          type: "chat",
          status: "ready",
          config: { botUuid: "bot-1", apiEndpoint: "https://good.example.com/chat" },
        })
        .returning();
      createdSolutionIds.push(s!.id);

      const before = await loadHandle(testUserId, s!.id);
      check("no row yet -> generation 0", before.generation === 0);

      await resetChatSession(testUserId, s!.id); // simulates "New chat" landing mid-stream
      const afterReset = await loadHandle(testUserId, s!.id);
      check(
        "New chat bumps generation",
        afterReset.generation === 1,
        `got ${afterReset.generation}`,
      );
      check("New chat nulls externalSessionUuid", afterReset.externalSessionUuid === null);

      const staleOk = await persistConversationIfUnchanged({
        userId: testUserId,
        solutionId: s!.id,
        externalSessionUuid: "conv-STALE",
        atGeneration: 0, // read before the (simulated) New chat
        atChatConfigVersion: 0,
      });
      check("stale-generation persist is rejected", staleOk === false);
      const afterStale = await loadHandle(testUserId, s!.id);
      check(
        "stale conversation id was NOT persisted",
        afterStale.externalSessionUuid === null,
        String(afterStale.externalSessionUuid),
      );

      const freshOk = await persistConversationIfUnchanged({
        userId: testUserId,
        solutionId: s!.id,
        externalSessionUuid: "conv-FRESH",
        atGeneration: 1, // current generation
        atChatConfigVersion: 0,
      });
      check("current-generation persist succeeds", freshOk === true);
      const afterFresh = await loadHandle(testUserId, s!.id);
      check("fresh conversation id persisted", afterFresh.externalSessionUuid === "conv-FRESH");
    }

    console.info("\n[8] conversation-handle: config-version guard, incl. no-handle-row-yet");
    {
      const [s] = await db
        .insert(solution)
        .values({
          name: `chat-proxy-ver-${suffix}`,
          slug: `chat-proxy-ver-${suffix}`,
          type: "chat",
          status: "ready",
          config: { botUuid: "bot-2", apiEndpoint: "https://good.example.com/chat" },
        })
        .returning();
      createdSolutionIds.push(s!.id);

      // Admin changes the endpoint/bot mid-stream (bumps chatConfigVersion),
      // simulated directly since the write-boundary bump is ticket 08's job.
      await db
        .update(solution)
        .set({ chatConfigVersion: sql`${solution.chatConfigVersion} + 1` })
        .where(eq(solution.id, s!.id));

      const staleOk = await persistConversationIfUnchanged({
        userId: testUserId,
        solutionId: s!.id,
        externalSessionUuid: "conv-STALE-CONFIG",
        atGeneration: 0,
        atChatConfigVersion: 0, // read before the config change; now stale
      });
      check("no-handle-row-yet persist at a stale config version is rejected", staleOk === false);
      const [rowAfterStale] = await db
        .select()
        .from(chatSessionHandle)
        .where(eq(chatSessionHandle.solutionId, s!.id));
      check("no row was created for the stale-config attempt", rowAfterStale === undefined);

      const freshOk = await persistConversationIfUnchanged({
        userId: testUserId,
        solutionId: s!.id,
        externalSessionUuid: "conv-VALID-CONFIG",
        atGeneration: 0,
        atChatConfigVersion: 1, // current version
      });
      check("persist at the current config version succeeds", freshOk === true);
    }

    console.info(
      "\n[9] conversation-handle: lease expired-takeover, old-finally-doesn't-clear-newer, concurrent-send",
    );
    {
      const [s] = await db
        .insert(solution)
        .values({
          name: `chat-proxy-lease-${suffix}`,
          slug: `chat-proxy-lease-${suffix}`,
          type: "chat",
          status: "ready",
          config: { botUuid: "bot-3", apiEndpoint: "https://good.example.com/chat" },
        })
        .returning();
      createdSolutionIds.push(s!.id);

      const gotA = await acquireLease(testUserId, s!.id, "owner-A", 50);
      check("first send acquires the lease", gotA === true);
      const gotB = await acquireLease(testUserId, s!.id, "owner-B", 50);
      check("second concurrent send is rejected (already-sending)", gotB === false);

      await new Promise((r) => setTimeout(r, 80)); // let A's lease expire
      const gotC = await acquireLease(testUserId, s!.id, "owner-C", 50);
      check("expired lease can be taken over", gotC === true);

      await releaseLease(testUserId, s!.id, "owner-A"); // A's delayed `finally`
      const [afterOldFinally] = await db
        .select({ leaseOwner: chatSessionHandle.leaseOwner })
        .from(chatSessionHandle)
        .where(eq(chatSessionHandle.solutionId, s!.id));
      check(
        "an old request's finally does not clear a newer lease",
        afterOldFinally?.leaseOwner === "owner-C",
        String(afterOldFinally?.leaseOwner),
      );

      await releaseLease(testUserId, s!.id, "owner-C");
      const [afterRealRelease] = await db
        .select({ leaseOwner: chatSessionHandle.leaseOwner })
        .from(chatSessionHandle)
        .where(eq(chatSessionHandle.solutionId, s!.id));
      check("the current owner's release clears the lease", afterRealRelease?.leaseOwner === null);

      // True concurrency: two acquireLease calls racing for real, not simulated sequentially.
      const [s2] = await db
        .insert(solution)
        .values({
          name: `chat-proxy-lease2-${suffix}`,
          slug: `chat-proxy-lease2-${suffix}`,
          type: "chat",
          status: "ready",
          config: { botUuid: "bot-4", apiEndpoint: "https://good.example.com/chat" },
        })
        .returning();
      createdSolutionIds.push(s2!.id);
      const [raceX, raceY] = await Promise.all([
        acquireLease(testUserId, s2!.id, "race-X", 5_000),
        acquireLease(testUserId, s2!.id, "race-Y", 5_000),
      ]);
      check(
        "exactly one concurrent acquireLease call wins",
        raceX !== raceY,
        `X=${raceX} Y=${raceY}`,
      );
    }

    console.info("\n[10] route: type-guard (Ready, granted Embedded solution -> 400, not 500)");
    {
      const [g] = await db
        .insert(group)
        .values({ name: `chat-proxy-group-${suffix}` })
        .returning();
      createdGroupIds.push(g!.id);
      await db.insert(groupMember).values({ groupId: g!.id, userId: testUserId });

      const [embedded] = await db
        .insert(solution)
        .values({
          name: `chat-proxy-embedded-${suffix}`,
          slug: `chat-proxy-embedded-${suffix}`,
          type: "embedded",
          status: "ready",
          config: { iframeUrl: "https://embed.example.com/app" },
        })
        .returning();
      createdSolutionIds.push(embedded!.id);
      await db.insert(groupSolution).values({ groupId: g!.id, solutionId: embedded!.id });

      const signInRes = await auth.api.signInEmail({
        body: { email: testEmail, password: testPassword },
        asResponse: true,
      });
      const setCookie = signInRes.headers.getSetCookie?.() ?? [];
      const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");

      const { POST } = await import("@/app/api/chat/route");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieHeader },
        body: JSON.stringify({ solutionId: embedded!.id, prompt: "hello" }),
      });
      const res = await POST(req);
      check(
        "Ready, granted Embedded solution POSTed to /api/chat returns 400, not 500",
        res.status === 400,
        `got ${res.status}`,
      );
    }
  } finally {
    // Cleanup — only rows this script created (cascades handle/groupMember/groupSolution).
    for (const id of createdSolutionIds) {
      // eslint-disable-next-line no-await-in-loop
      await db.delete(solution).where(eq(solution.id, id));
    }
    for (const id of createdGroupIds) {
      // eslint-disable-next-line no-await-in-loop
      await db.delete(group).where(eq(group.id, id));
    }
    if (testUserId) {
      const { user } = await import("@/server/db/schema");
      await db.delete(user).where(eq(user.id, testUserId));
    }
  }

  console.info(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(2);
});
