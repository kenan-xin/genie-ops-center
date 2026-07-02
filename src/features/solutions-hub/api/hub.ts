"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useTRPC } from "@/trpc/provider";

import type { ListHubInput } from "../schemas/hub";

// Feature query/mutation wrappers — AGENTS.md folder contract, features/<domain>/api/.

type TRPC = ReturnType<typeof useTRPC>;

/** All three list views share the favorite state, so a toggle invalidates them all. */
function invalidateListViews(trpc: TRPC, queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: trpc.solutionsHub.list.queryKey() });
  void queryClient.invalidateQueries({ queryKey: trpc.solutionsHub.favorites.queryKey() });
  void queryClient.invalidateQueries({ queryKey: trpc.solutionsHub.recents.queryKey() });
}

export function useHubSolutions(input?: ListHubInput) {
  const trpc = useTRPC();
  return useQuery(trpc.solutionsHub.list.queryOptions(input ?? { sort: "recent" }));
}

export function useRecents() {
  const trpc = useTRPC();
  return useQuery(trpc.solutionsHub.recents.queryOptions());
}

export function useFavorites() {
  const trpc = useTRPC();
  return useQuery(trpc.solutionsHub.favorites.queryOptions());
}

export function useToggleFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    trpc.solutionsHub.toggleFavorite.mutationOptions({
      onSuccess: () => {
        invalidateListViews(trpc, queryClient);
        // The PINNED rail is rendered by the server (workspace) layout from a
        // server-caller fetch, so client query invalidation alone leaves it
        // stale until navigation. Re-run the server components (Phase-3 review).
        router.refresh();
      },
    }),
  );
}

export function useRecordRecent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutionsHub.recordRecent.mutationOptions({
      onSuccess: () => {
        // Recording a recent affects the hub's "recent" sort + the side rail.
        void queryClient.invalidateQueries({ queryKey: trpc.solutionsHub.list.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.solutionsHub.recents.queryKey() });
      },
    }),
  );
}
