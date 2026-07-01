"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

import type { ListSolutionsInput } from "../schemas/solution";

// Feature query/mutation wrappers — AGENTS.md folder contract, features/<domain>/api/.

const listQueryKey = (trpc: ReturnType<typeof useTRPC>) => trpc.solutions.list.queryKey();

export function useSolutionsQuery(input?: ListSolutionsInput) {
  const trpc = useTRPC();
  return useQuery(trpc.solutions.list.queryOptions(input ?? { sort: "updated" }));
}

export function useSolutionQuery(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.solutions.get.queryOptions({ id }));
}

function invalidateList(
  trpc: ReturnType<typeof useTRPC>,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: listQueryKey(trpc) });
}

export function useRegisterSolution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.register.mutationOptions({
      onSuccess: () => invalidateList(trpc, queryClient),
    }),
  );
}

export function useUpdateSolution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.update.mutationOptions({
      onSuccess: (data) => {
        invalidateList(trpc, queryClient);
        void queryClient.invalidateQueries({
          queryKey: trpc.solutions.get.queryKey({ id: data.id }),
        });
      },
    }),
  );
}

export function useSetSolutionStatus() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.setStatus.mutationOptions({
      onSuccess: () => invalidateList(trpc, queryClient),
    }),
  );
}

export function useDuplicateSolution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.duplicate.mutationOptions({
      onSuccess: () => invalidateList(trpc, queryClient),
    }),
  );
}

export function useArchiveSolution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.archive.mutationOptions({
      onSuccess: () => invalidateList(trpc, queryClient),
    }),
  );
}

export function useUnarchiveSolution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.unarchive.mutationOptions({
      onSuccess: () => invalidateList(trpc, queryClient),
    }),
  );
}

export function useDeleteSolution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.solutions.remove.mutationOptions({
      onSuccess: () => invalidateList(trpc, queryClient),
    }),
  );
}
