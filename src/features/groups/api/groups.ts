"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Feature query/mutation wrappers (AGENTS.md folder contract, features/<domain>/api/).

function invalidateGroupViews(
  trpc: ReturnType<typeof useTRPC>,
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries(trpc.groups.list.queryFilter()),
    queryClient.invalidateQueries(trpc.groups.get.queryFilter({ id: groupId })),
    queryClient.invalidateQueries(trpc.groups.overviewBySolution.queryFilter()),
    queryClient.invalidateQueries(trpc.groups.overviewByPerson.queryFilter()),
  ]);
}

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
      onSuccess: () => queryClient.invalidateQueries(trpc.groups.list.queryFilter()),
    }),
  );
}

export function useUpdateGroup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.update.mutationOptions({
      onSuccess: (_data, variables) =>
        Promise.all([
          invalidateGroupViews(trpc, queryClient, variables.id),
          queryClient.invalidateQueries(trpc.users.list.queryFilter()),
        ]),
    }),
  );
}

export function useDeleteGroup() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.remove.mutationOptions({
      onSuccess: (_data, variables) =>
        Promise.all([
          invalidateGroupViews(trpc, queryClient, variables.id),
          queryClient.invalidateQueries(trpc.users.list.queryFilter()),
        ]),
    }),
  );
}

export function useSetMembers() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.setMembers.mutationOptions({
      onSuccess: (_data, variables) =>
        Promise.all([
          invalidateGroupViews(trpc, queryClient, variables.groupId),
          queryClient.invalidateQueries(trpc.users.list.queryFilter()),
        ]),
    }),
  );
}

export function useSetSolutions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.groups.setSolutions.mutationOptions({
      onSuccess: (_data, variables) => invalidateGroupViews(trpc, queryClient, variables.groupId),
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
