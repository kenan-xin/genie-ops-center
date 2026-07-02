import "server-only";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { solution } from "@/server/db/schema";
import { assertCanRun } from "@/server/features/solution-access";
import { configByTypeSchema } from "@/features/solutions/schemas/solution";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

import { resetChatSession } from "./conversation-handle";
import { newChatSchema } from "../schemas/chat";

/**
 * Chat session lifecycle (tech-plan → "Conversation model"). The streaming
 * send itself is `/api/chat` (ticket 13, a plain Route Handler, not tRPC —
 * ai-sdk's transport wants a raw fetch endpoint). `newChat` is the one
 * chat-domain mutation that fits tRPC's request/response shape; ticket 14
 * wires it to the "New chat" button.
 */
export const chatRouter = createTRPCRouter({
  newChat: protectedProcedure.input(newChatSchema).mutation(async ({ ctx, input }) => {
    const [row] = await db
      .select({
        status: solution.status,
        archived: solution.archived,
        id: solution.id,
        type: solution.type,
        config: solution.config,
      })
      .from(solution)
      .where(eq(solution.id, input.solutionId))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not available" });
    await assertCanRun(ctx.auth.user, row);

    // Independent type guard (review P2-A, mirrors the route's critique B4):
    // assertCanRun never checks type, so a Ready, granted Embedded solution
    // must be rejected before it can create a chat_session_handle row.
    const parsedConfig = configByTypeSchema.safeParse({ type: row.type, config: row.config });
    if (!parsedConfig.success || parsedConfig.data.type !== "chat") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This solution does not support chat" });
    }

    // Lease guard (review P1-A): a direct tRPC `newChat` while a `/api/chat`
    // send is mid-stream must not bump generation / clear the handle. CONFLICT
    // (409) matches the route's "already-sending" response.
    const reset = await resetChatSession(ctx.auth.user.id, input.solutionId);
    if (!reset) {
      throw new TRPCError({ code: "CONFLICT", message: "already-sending" });
    }
    return { ok: true as const };
  }),
});
