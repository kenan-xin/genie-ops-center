import "server-only";

import {
  dehydrate,
  HydrationBoundary,
  type DefaultError,
  type FetchQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";

import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";

import { makeQueryClient } from "./query-client";

// `cache()` scopes one QueryClient per request so a page's `prefetch()` calls
// and its `<HydrateClient>` see the same instance without threading it through props.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createTRPCContext,
  queryClient: getQueryClient,
});

export function prefetch<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(queryOptions: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  void getQueryClient().prefetchQuery(queryOptions);
}

export function HydrateClient({ children }: { children: React.ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
