"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Feature query/mutation wrappers (AGENTS.md folder contract, features/<domain>/api/).

const LIST_KEY = ["groups", "list"] as const;

export function useGroupsQuery(search?: string) {
  const trpc = useTRPC();
  const input = search?.trim() ? { search } : undefined;
  return useQuery(trpc.groups.list.queryOptions(input));
}

export function useGroupQuery(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.groups.get.queryOptions({ id }));
}

export function useCreateGroup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.create.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: LIST_KEY }),
    }),
  );
}

export function useUpdateGroup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      },
    }),
  );
}

export function useDeleteGroup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.remove.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: LIST_KEY }),
    }),
  );
}

/** Membership and grant writes also dirty the People directory (group badges) and the overview. */
export function useSetMembers() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.setMembers.mutationOptions({
      onSuccess: (_data, variables) => {
        void queryClient.invalidateQueries({ queryKey: LIST_KEY });
        void queryClient.invalidateQueries({
          queryKey: trpc.groups.get.queryKey({ id: variables.groupId }),
        });
        void queryClient.invalidateQueries({ queryKey: ["users", "list"] });
        void queryClient.invalidateQueries({ queryKey: ["groups", "overviewBySolution"] });
        void queryClient.invalidateQueries({ queryKey: ["groups", "overviewByPerson"] });
      },
    }),
  );
}

export function useSetSolutions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.setSolutions.mutationOptions({
      onSuccess: (_data, variables) => {
        void queryClient.invalidateQueries({ queryKey: LIST_KEY });
        void queryClient.invalidateQueries({
          queryKey: trpc.groups.get.queryKey({ id: variables.groupId }),
        });
        void queryClient.invalidateQueries({ queryKey: ["groups", "overviewBySolution"] });
        void queryClient.invalidateQueries({ queryKey: ["groups", "overviewByPerson"] });
      },
    }),
  );
}

export function useOverviewBySolution() {
  const trpc = useTRPC();
  return useQuery(trpc.groups.overviewBySolution.queryOptions());
}

export function useOverviewByPerson() {
  const trpc = useTRPC();
  return useQuery(trpc.groups.overviewByPerson.queryOptions());
}
