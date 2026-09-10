import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AppRouter } from "@/server/trpc/router";
import { TRPCProvider } from "@/trpc/provider";

import {
  useCreateGroup,
  useDeleteGroup,
  useSetMembers,
  useSetSolutions,
  useUpdateGroup,
} from "./groups";

function useGroupMutations() {
  return {
    create: useCreateGroup(),
    update: useUpdateGroup(),
    remove: useDeleteGroup(),
    members: useSetMembers(),
    solutions: useSetSolutions(),
  };
}

const groupViews = [
  "all groups",
  "searched groups",
  "inactive groups",
  "group detail",
  "by solution",
  "by person",
];
const peopleViews = ["all people", "searched people", "inactive people"];

const cases = [
  { action: "create", refreshed: ["all groups", "searched groups", "inactive groups"] },
  { action: "update", refreshed: [...groupViews, ...peopleViews] },
  { action: "remove", refreshed: [...groupViews, ...peopleViews] },
  { action: "members", refreshed: [...groupViews, ...peopleViews] },
  { action: "solutions", refreshed: groupViews },
] as const;

describe("group mutation cache refresh", () => {
  it.each(cases)(
    "$action refreshes the affected views and cached search variants",
    async ({ action, refreshed }) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, retry: false } },
      });
      let revision = 1;
      const client = createTRPCClient<AppRouter>({
        links: [
          () =>
            ({ op }) =>
              observable((observer) => {
                if (op.type === "mutation") revision += 1;
                observer.next({ result: { data: { revision } } });
                observer.complete();
              }),
        ],
      });
      const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient });
      let mutations: ReturnType<typeof useGroupMutations> | undefined;
      function Probe() {
        mutations = useGroupMutations();
        return null;
      }
      const providerProps = { trpcClient: client, queryClient, children: createElement(Probe) };
      renderToString(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(TRPCProvider, providerProps),
        ),
      );

      // Use the same generated options as the screens. Only transport data is stubbed.
      const views = [
        { name: "all groups", options: trpc.groups.list.queryOptions() },
        { name: "searched groups", options: trpc.groups.list.queryOptions({ search: "support" }) },
        {
          name: "inactive groups",
          options: trpc.groups.list.queryOptions({ search: "sales" }),
          inactive: true,
        },
        { name: "group detail", options: trpc.groups.get.queryOptions({ id: "group-1" }) },
        {
          name: "unrelated group detail",
          options: trpc.groups.get.queryOptions({ id: "group-2" }),
        },
        { name: "all people", options: trpc.users.list.queryOptions() },
        {
          name: "searched people",
          options: trpc.users.list.queryOptions({ search: "alice", sort: "name" }),
        },
        {
          name: "inactive people",
          options: trpc.users.list.queryOptions({ sort: "role" }),
          inactive: true,
        },
        { name: "by solution", options: trpc.groups.overviewBySolution.queryOptions() },
        { name: "by person", options: trpc.groups.overviewByPerson.queryOptions() },
        { name: "themes", options: trpc.themes.list.queryOptions() },
      ];
      const unsubscribe: (() => void)[] = [];
      try {
        await Promise.all(
          views.map(async ({ options, inactive }) => {
            const observer = new QueryObserver<
              unknown,
              Error,
              unknown,
              unknown,
              typeof options.queryKey
            >(queryClient, {
              queryKey: options.queryKey,
              queryFn: options.queryFn,
            });
            await observer.refetch();
            if (!inactive) unsubscribe.push(observer.subscribe(() => {}));
            else observer.destroy();
          }),
        );

        expect(mutations).toBeDefined();
        switch (action) {
          case "create":
            await mutations!.create.mutateAsync({ name: "Support" });
            break;
          case "update":
            await mutations!.update.mutateAsync({ id: "group-1", name: "Support" });
            break;
          case "remove":
            await mutations!.remove.mutateAsync({ id: "group-1" });
            break;
          case "members":
            await mutations!.members.mutateAsync({ groupId: "group-1", userIds: ["alice"] });
            break;
          case "solutions":
            await mutations!.solutions.mutateAsync({
              groupId: "group-1",
              solutionIds: ["solution-1"],
            });
            break;
        }

        await Promise.all(
          views.map(async ({ name, options, inactive }) => {
            const shouldRefresh = (refreshed as readonly string[]).includes(name);
            const state = queryClient.getQueryState(options.queryKey);
            if (inactive) {
              expect(state?.isInvalidated, name).toBe(shouldRefresh);
              expect(state?.data, name).toEqual({ revision: 1 });
              const observer = new QueryObserver<
                unknown,
                Error,
                unknown,
                unknown,
                typeof options.queryKey
              >(queryClient, {
                queryKey: options.queryKey,
                queryFn: options.queryFn,
              });
              unsubscribe.push(observer.subscribe(() => {}));
              if (shouldRefresh) await observer.getCurrentQuery().promise;
            }
            expect(queryClient.getQueryData(options.queryKey), name).toEqual({
              revision: shouldRefresh ? 2 : 1,
            });
          }),
        );
      } finally {
        unsubscribe.forEach((stop) => stop());
        queryClient.clear();
      }
    },
  );
});
