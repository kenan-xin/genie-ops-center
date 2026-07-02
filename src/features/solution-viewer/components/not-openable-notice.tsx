"use client";

import Link from "next/link";

/**
 * Shown when a solution has no live path in foundation. Today that's only
 * `native` (enum-only, hidden from the catalogue — tech-plan non-goal) reached
 * via a direct `/s/[slug]` visit. The see guard passed, so we name the solution
 * rather than hiding existence; the run guard can't pass because there is no
 * runtime. Mirrors the centered-card treatment of the status notices.
 */
export function NotOpenableNotice({ name }: { name: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: "34px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ width: 30, height: 3, background: "var(--ink3)", margin: "0 auto" }} />
        <div
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.12em",
            color: "var(--ink3)",
            marginTop: 16,
          }}
        >
          ● NOT AVAILABLE
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--t-h2)",
            color: "var(--ink)",
            marginTop: 8,
            letterSpacing: "-0.01em",
          }}
        >
          {name} can&rsquo;t be opened here
        </div>
        <div
          style={{
            fontSize: "var(--t-body)",
            color: "var(--ink2)",
            marginTop: 8,
            lineHeight: 1.55,
          }}
        >
          This solution type doesn&rsquo;t have a workspace experience yet.
        </div>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginTop: 20,
            height: 40,
            padding: "0 20px",
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "var(--t-body)",
            textDecoration: "none",
          }}
        >
          ← Back to solutions
        </Link>
      </div>
    </div>
  );
}
