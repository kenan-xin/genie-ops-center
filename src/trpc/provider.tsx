"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";

import type { AppRouter } from "@/server/trpc/router";

import { makeQueryClient } from "./query-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always a fresh client so requests don't share cache.
    return makeQueryClient();
  }
  // Browser: reuse a single client across renders.
  return (browserQueryClient ??= makeQueryClient());
}

function getUrl() {
  if (typeof window !== "undefined") return "/api/trpc";
  // Server: this app is one Docker image per customer deployment (not
  // serverless), so PUBLIC_BASE_URL (also used by src/server/auth.ts for
  // cookies/redirects) is the right base, not a platform-specific host var.
  const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: getUrl() })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
      {/* Dev-only; the `false &&` branch is dead-code-eliminated from prod. */}
      {process.env.NODE_ENV !== "production" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
