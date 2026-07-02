"use client";

import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";

import { useFavorites, useRecents } from "../api/hub";
import type { HubSolution } from "../server/queries";
import { SolutionListRow } from "./solution-list-row";

/**
 * Shared Recent/Favorites list surface (FR-HUB-09). Both pages are the same
 * shape: a title + subtitle, then either a bordered list of rows or an empty
 * state with a "Browse solutions" link back to the hub. Rows reuse the hub row
 * (monogram, status badge, favorite star) and gate access server-side via the
 * same predicate the hub uses.
 */
export function SolutionListPage({
  variant,
  title,
  subtitle,
  empty,
}: {
  variant: "recents" | "favorites";
  title: string;
  subtitle: string;
  empty: { icon: string; heading: string; body: string };
}) {
  const query = variant === "recents" ? useRecents() : useFavorites();
  const solutions = query.data;
  const has = (solutions?.length ?? 0) > 0;

  return (
    <div className="cs-hubpad" style={{ maxWidth: "var(--content-wide)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "var(--t-h3)",
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h1>
      <p style={{ margin: "4px 0 0", fontSize: "var(--t-body)", color: "var(--ink2)" }}>
        {subtitle}
      </p>

      {query.isPending ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} style={{ height: 56, width: "100%" }} />
          ))}
        </div>
      ) : has ? (
        <List solutions={solutions!} />
      ) : (
        <EmptyState {...empty} />
      )}
    </div>
  );
}

function List({ solutions }: { solutions: HubSolution[] }) {
  return (
    <div style={{ marginTop: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
      <div
        className="cs-thead"
        style={{
          gridTemplateColumns: "2.4fr .8fr .8fr .6fr 40px",
          padding: "12px 16px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          font: "600 var(--m-xs) var(--font-mono)",
          letterSpacing: "0.07em",
          color: "var(--ink2)",
        }}
      >
        <span>SOLUTION</span>
        <span>TYPE</span>
        <span>STATUS</span>
        <span style={{ textAlign: "right" }}>UPDATED</span>
        <span />
      </div>
      {solutions.map((s) => (
        <SolutionListRow key={s.id} solution={s} sort="recent" />
      ))}
    </div>
  );
}

function EmptyState({ icon, heading, body }: { icon: string; heading: string; body: string }) {
  return (
    <div
      style={{
        marginTop: 20,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          border: "1.5px dashed var(--line)",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink3)",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "var(--t-h3)",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "var(--t-title)",
          color: "var(--ink)",
          marginTop: 14,
        }}
      >
        {heading}
      </div>
      <div style={{ fontSize: "var(--t-sm)", color: "var(--ink2)", marginTop: 5 }}>{body}</div>
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginTop: 14,
          height: 32,
          lineHeight: "32px",
          padding: "0 14px",
          border: "1px solid var(--line)",
          background: "transparent",
          fontWeight: 600,
          fontSize: "var(--t-sm)",
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
        Browse solutions
      </Link>
    </div>
  );
}
