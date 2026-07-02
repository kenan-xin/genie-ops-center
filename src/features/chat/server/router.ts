import "server-only";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { solution } from "@/server/db/schema";
import { assertCanRun } from "@/server/features/solution-access";
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
      .select({ status: solution.status, archived: solution.archived, id: solution.id })
      .from(solution)
      .where(eq(solution.id, input.solutionId))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not available" });
    await assertCanRun(ctx.auth.user, row);
    await resetChatSession(ctx.auth.user.id, input.solutionId);
    return { ok: true as const };
  }),
});
