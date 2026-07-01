import { caller } from "@/server/trpc/caller";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { HelloClient } from "./hello-client";

export default async function HubPage() {
  // RSC roundtrip: direct server caller, no HTTP hop.
  const server = await caller.hello({ name: "operator" });
  // Prefetches the exact query HelloClient runs client-side, so it hydrates
  // instead of showing a loading flash on mount.
  prefetch(trpc.hello.queryOptions({ name: "browser" }));

  return (
    <HydrateClient>
      <section className="flex flex-col gap-4">
        <span
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Overview
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--t-display)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Hub
        </h1>
        <p style={{ maxWidth: "60ch", color: "var(--ink2)" }}>
          Scaffolding shell. Solutions, access and admin land in later tickets.
        </p>

        <div
          className="flex flex-col gap-2 p-4"
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink2)" }}>
            <span
              style={{
                font: "600 var(--m-xs) var(--font-mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink3)",
              }}
            >
              Server caller
            </span>{" "}
            {server.greeting}
          </div>
          <HelloClient />
        </div>
      </section>
    </HydrateClient>
  );
}
