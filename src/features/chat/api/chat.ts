"use client";

import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Feature query/mutation wrappers — AGENTS.md folder contract, features/<domain>/api/.
// The streaming send itself goes through /api/chat (a plain Route Handler,
// not tRPC); this wraps the one chat-domain mutation that fits tRPC's
// request/response shape (see features/chat/server/router.ts).

export function useNewChat() {
  const trpc = useTRPC();
  return useMutation(trpc.chat.newChat.mutationOptions());
}
