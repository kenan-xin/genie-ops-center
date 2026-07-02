"use client";

import Link from "next/link";

import { useWorkspaceChromeStore } from "@/app/(workspace)/_lib/chrome-store";

/**
 * The viewer's toolbar (prototype lines 238–245) — rendered at the top of the
 * viewer content (inside <main>), NOT in the shell header, so it travels with
 * the solution surface and disappears under standalone/present modes (where the
 * shell header is hidden and the floating Exit control takes over).
 *
 * Controls (FR-VIEW-06): `← Hub` (back to the catalogue), the type label, the
 * `▤` sidebar-only toggle (collapses the sidebar, header stays), and
 * `⤢ Fullscreen` (enters `standalone` mode — hides sidebar + header for an
 * edge-to-edge view). The shell's own header still shows the route title +
 * theme toggle above this row.
 */
const TYPE_LABEL: Record<"chat" | "embedded" | "native", string> = {
  chat: "Chat",
  embedded: "Smart-API",
  native: "Native",
};

export function ViewerToolbar({
  name,
  type,
}: {
  name: string;
  type: "chat" | "embedded" | "native";
}) {
  const sidebarHidden = useWorkspaceChromeStore((s) => s.sidebarHidden);
  const setSidebarHidden = useWorkspaceChromeStore((s) => s.setSidebarHidden);
  const setMode = useWorkspaceChromeStore((s) => s.setMode);

  return (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Link
          href="/"
          className="csghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 30,
            padding: "0 11px",
            border: "1px solid var(--line)",
            fontSize: "var(--t-sm)",
            fontWeight: 600,
            color: "var(--ink)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          ← Hub
        </Link>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--t-title)",
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
        <span
          className="cs-hidef"
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.06em",
            color: "var(--brandink)",
            border: "1px solid var(--line)",
            padding: "3px 7px",
            flexShrink: 0,
          }}
        >
          {TYPE_LABEL[type]}
        </span>
      </div>
      <div className="cs-hidef" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
          aria-pressed={sidebarHidden}
          title="Toggle sidebar"
          onClick={() => setSidebarHidden(!sidebarHidden)}
          className="csghost"
          style={{
            width: 30,
            height: 30,
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "var(--t-body)",
            color: "var(--ink2)",
            background: "transparent",
          }}
        >
          ▤
        </button>
        <button
          type="button"
          title="Hide all chrome and view the solution edge-to-edge"
          onClick={() => setMode("standalone")}
          style={{
            height: 30,
            padding: "0 12px",
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
            fontSize: "var(--t-sm)",
            fontWeight: 700,
          }}
        >
          ⤢ Fullscreen
        </button>
      </div>
    </div>
  );
}
