"use client";

import Link from "next/link";

/**
 * FR-VIEW-05 — a non-interactive status notice shown INSTEAD of the live
 * experience when a seeable solution is `maintenance` or `down`. The see guard
 * has already passed (the user is granted the solution); the run guard has not
 * (status ≠ ready), so no iframe/chat loads. Lifted verbatim from the prototype
 * (lines 467–492): centered card, severity bar, mono status line, display
 * headline, body copy, and a Back control.
 */
const COPY = {
  maintenance: {
    bar: "var(--warn)",
    tag: "● UNDER MAINTENANCE",
    title: (n: string) => `${n} is being updated`,
    body: "This solution is temporarily offline for scheduled maintenance. It'll be back shortly — try again in a little while.",
  },
  down: {
    bar: "var(--error)",
    tag: "● SERVICE UNAVAILABLE",
    title: (n: string) => `${n} is currently down`,
    body: "We're aware of an outage affecting this solution and are working to restore it. Your workspace admin has been notified.",
  },
} as const;

export function StatusNotice({ status, name }: { status: "maintenance" | "down"; name: string }) {
  const c = COPY[status];
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
        <div style={{ width: 30, height: 3, background: c.bar, margin: "0 auto" }} />
        <div
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.12em",
            color: c.bar,
            marginTop: 16,
          }}
        >
          {c.tag}
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
          {c.title(name)}
        </div>
        <div
          style={{
            fontSize: "var(--t-body)",
            color: "var(--ink2)",
            marginTop: 8,
            lineHeight: 1.55,
          }}
        >
          {c.body}
        </div>
        {status === "maintenance" ? (
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
        ) : (
          <div style={{ marginTop: 18, display: "flex", gap: 9, justifyContent: "center" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 40,
                padding: "0 16px",
                border: "1px solid var(--line)",
                background: "transparent",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: "var(--t-body)",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              ← Back
            </Link>
            <a
              href="https://status.genie.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 40,
                padding: "0 20px",
                background: "var(--brand)",
                color: "#fff",
                border: "none",
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: "var(--t-body)",
                textDecoration: "none",
              }}
            >
              View status page ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
