"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast";

export type FeedbackVote = "up" | "down";

/**
 * Ephemeral, client-only message feedback (FR-VIEW-02, ticket scope —
 * durable feedback/transcripts are deferred). Keyed by message id; re-tapping
 * the active vote clears it. Resets whenever the chat panel remounts (e.g.
 * "New chat"), which is the desired behavior since there's nothing to persist.
 */
export function useChatFeedback() {
  const [votes, setVotes] = useState<Record<string, FeedbackVote>>({});
  const { toast } = useToast();

  const rate = useCallback(
    (messageId: string, vote: FeedbackVote) => {
      const isClearing = votes[messageId] === vote;
      setVotes((prev) => {
        const next = { ...prev };
        if (isClearing) {
          delete next[messageId];
        } else {
          next[messageId] = vote;
        }
        return next;
      });
      if (!isClearing && vote === "down") {
        toast({ tone: "info", description: "Thanks — we'll use this to improve responses." });
      }
    },
    [votes, toast],
  );

  return { votes, rate };
}
