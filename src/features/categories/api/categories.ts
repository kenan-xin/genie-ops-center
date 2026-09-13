"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Feature query/mutation wrappers — AGENTS.md folder contract, features/<domain>/api/.

type TRPC = ReturnType<typeof useTRPC>;

/** Any taxonomy write changes the admin views and the customer rail. */
function invalidateCategoryViews(trpc: TRPC, queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries(trpc.categories.list.queryFilter()),
    queryClient.invalidateQueries(trpc.categories.assignments.queryFilter()),
    queryClient.invalidateQueries(trpc.categories.sidebar.queryFilter()),
  ]);
}

export function useCategories() {
  const trpc = useTRPC();
  return useQuery(trpc.categories.list.queryOptions());
}

export function useAssignments() {
  const trpc = useTRPC();
  return useQuery(trpc.categories.assignments.queryOptions());
}

export function useSidebarEntries() {
  const trpc = useTRPC();
  return useQuery(trpc.categories.sidebar.queryOptions());
}

export function useCreateCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.create.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useRenameCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.rename.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useDeleteCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.remove.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useReorderCategories() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.reorder.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useAssignCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.assign.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}
