"use client";

import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

import { useWorkspaceChromeStore } from "../_lib/chrome-store";

/**
 * The 54px route-aware header (prototype line 235–249). Left: hamburger (opens
 * the off-canvas drawer; shown only <920px via CSS), page title derived from the
 * route. Right: theme toggle. The viewer's chrome-mode controls (sidebar toggle,
 * Fullscreen/standalone) live on the viewer route (ticket 12), not here.
 */
function titleFor(pathname: string): string {
  if (pathname === "/") return "Solutions";
  if (pathname.startsWith("/favorites")) return "Favorites";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/s/")) return "Solution";
  return "Workspace";
}

export function WorkspaceHeader() {
  const pathname = usePathname();
  const setDrawerOpen = useWorkspaceChromeStore((s) => s.setDrawerOpen);

  return (
    <div
      className="ws-header"
      style={{
        height: 54,
        flexShrink: 0,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setDrawerOpen(true)}
          className="ws-burger"
          style={{
            // display is owned by `.ws-burger` in globals.css (inline-flex <920px,
            // none ≥920px) — do NOT set it inline here, or it beats the media query
            // and the hamburger shows on desktop too (Phase-3 review P1).
            width: 32,
            height: 32,
            border: "1px solid var(--line)",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "var(--t-title)",
            color: "var(--ink2)",
            background: "transparent",
            flexShrink: 0,
          }}
        >
          ☰
        </button>
        <div
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
          {titleFor(pathname)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ThemeToggle />
      </div>
    </div>
  );
}
