"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Proves the client roundtrip: tanstack-query hook → /api/trpc → router.
export function HelloClient() {
  const trpc = useTRPC();
  const query = useQuery(trpc.hello.queryOptions({ name: "browser" }));

  return (
    <div style={{ fontSize: "var(--t-sm)", color: "var(--ink2)" }}>
      <span
        style={{
          font: "600 var(--m-xs) var(--font-mono)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        Client hook
      </span>{" "}
      {query.isPending ? "…" : query.data?.greeting}
    </div>
  );
}
