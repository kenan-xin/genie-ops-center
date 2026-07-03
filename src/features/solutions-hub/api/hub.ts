"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

import type { HubSolution } from "../server/queries";
import type { ListHubInput, ReorderFavoritesInput } from "../schemas/hub";

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
  return useMutation(
    trpc.solutionsHub.toggleFavorite.mutationOptions({
      onSuccess: () => {
        // The PINNED rail now reads live via useFavorites(), so invalidating
        // the three list views is enough to keep it in sync — no
        // router.refresh() needed.
        invalidateListViews(trpc, queryClient);
      },
    }),
  );
}

/**
 * Persist the rail's drag-reordered arrangement, optimistically. `onMutate`
 * writes the reordered list straight into the favorites query cache so the
 * rail reflects the drop instantly; `onError` rolls back; `onSettled`
 * reconciles with the server (also refreshes list/recents, which share the
 * favorite flag).
 */
export function useReorderFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const favoritesKey = trpc.solutionsHub.favorites.queryKey();
  return useMutation(
    trpc.solutionsHub.reorderFavorites.mutationOptions({
      onMutate: async (input: ReorderFavoritesInput) => {
        await queryClient.cancelQueries({ queryKey: favoritesKey });
        const previous = queryClient.getQueryData<HubSolution[]>(favoritesKey);
        if (previous) {
          const byId = new Map(previous.map((f) => [f.id, f]));
          const reordered = input.orderedSolutionIds
            .map((id) => byId.get(id))
            .filter((f): f is HubSolution => f != null);
          const rest = previous.filter((f) => !input.orderedSolutionIds.includes(f.id));
          queryClient.setQueryData<HubSolution[]>(favoritesKey, [...reordered, ...rest]);
        }
        return { previous };
      },
      onError: (_err, _input, context) => {
        if (context?.previous) {
          queryClient.setQueryData<HubSolution[]>(favoritesKey, context.previous);
        }
      },
      onSettled: () => {
        invalidateListViews(trpc, queryClient);
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
