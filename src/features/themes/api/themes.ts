"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Feature query/mutation wrappers — AGENTS.md folder contract, features/<domain>/api/.

export function useThemesQuery() {
  const trpc = useTRPC();
  return useQuery(trpc.themes.list.queryOptions());
}

export function useThemeQuery(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.themes.get.queryOptions({ id }));
}

export function useCreateTheme() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.themes.create.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.themes.list.queryKey() }),
    }),
  );
}

export function useUpdateTheme() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.themes.update.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: trpc.themes.list.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.themes.get.queryKey({ id: data.id }) });
      },
    }),
  );
}

export function useDeleteTheme() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.themes.remove.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.themes.list.queryKey() }),
    }),
  );
}
