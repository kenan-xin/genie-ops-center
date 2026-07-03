"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";

import { IdleTimeout } from "@/components/idle-timeout";

import { OfflineIndicator } from "./offline-indicator";
import { PinnedFavorites } from "./pinned-favorites";
import { UserFooter } from "./user-footer";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceNav } from "./workspace-nav";
import { useWorkspaceChromeStore } from "../_lib/chrome-store";

/**
 * Customer workspace chrome — the client half of the server layout
 * (`(workspace)/layout.tsx` owns the auth gate; this owns the chrome).
 *
 * Layout (prototype "APP" block, lines 192–250):
 *  - 212px sidebar ≥920px; off-canvas 250px/max-84vw drawer + backdrop <920px.
 *  - Sidebar: G-tile + GENIE wordmark, primary nav (Solutions/Favorites/
 *    Account), PINNED favorites rail, bottom user footer.
 *  - 54px route-aware header with the hamburger inside it (mobile only).
 *
 * Chrome modes (FR-VIEW-06): `standalone` hides sidebar+header (edge-to-edge);
 * `present` is the same chrome-hidden state surfaced as full-screen. Both are
 * reversible via the floating Exit control. Route changes close the mobile
 * drawer so navigation never strands the drawer open.
 */
export function WorkspaceChrome({
  userName,
  userRole,
  children,
}: {
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const drawerOpen = useWorkspaceChromeStore((s) => s.drawerOpen);
  const setDrawerOpen = useWorkspaceChromeStore((s) => s.setDrawerOpen);
  const sidebarHidden = useWorkspaceChromeStore((s) => s.sidebarHidden);
  const setSidebarHidden = useWorkspaceChromeStore((s) => s.setSidebarHidden);
  const mode = useWorkspaceChromeStore((s) => s.mode);
  const exitMode = useWorkspaceChromeStore((s) => s.exitMode);

  // Close the mobile drawer + reset the viewer's sidebar-only toggle on
  // navigation, so a fresh route never opens with a hidden sidebar.
  useEffect(() => {
    setDrawerOpen(false);
    setSidebarHidden(false);
  }, [pathname, setDrawerOpen, setSidebarHidden]);

  const chromeHidden = mode === "standalone" || mode === "present";
  const sidebarCollapsed = !chromeHidden && sidebarHidden;

  const sidebarInner = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "15px 16px",
          borderBottom: "1px solid var(--line2)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 24,
            height: 24,
            background: "var(--ink)",
            color: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--t-body)",
          }}
        >
          G
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--t-sm)",
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          GENIE
        </span>
      </div>
      <div style={{ padding: "14px 12px", flex: 1, overflow: "auto", minHeight: 0 }}>
        <div
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.13em",
            color: "var(--ink3)",
            padding: "0 6px 8px",
          }}
        >
          WORKSPACE
        </div>
        <WorkspaceNav />
        <PinnedFavorites />
      </div>
      <UserFooter name={userName} role={userRole} />
    </>
  );

  return (
    <div
      className="ws-root"
      style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)" }}
    >
      <IdleTimeout />
      <OfflineIndicator />

      {/* Backdrop — mobile only, when the drawer is open. */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="ws-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,10,14,.45)",
            zIndex: 70,
            border: "none",
            cursor: "pointer",
          }}
        />
      ) : null}

      {/* Sidebar: persistent ≥920px, off-canvas drawer <920px (CSS-driven).
          The viewer's `▤` toggle collapses it alone (header stays); chrome
          modes hide it together with the header. */}
      {!chromeHidden && !sidebarCollapsed ? (
        <aside
          className="ws-side"
          data-open={drawerOpen ? "" : undefined}
          style={{
            background: "var(--sidebar)",
            borderRight: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {sidebarInner}
        </aside>
      ) : null}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "var(--bg)",
        }}
      >
        {!chromeHidden ? <WorkspaceHeader /> : null}
        <main style={{ flex: 1, overflow: "auto", minHeight: 0 }}>{children}</main>
      </div>

      {/* Floating Exit control for standalone/present modes (FR-VIEW-06). */}
      {chromeHidden ? (
        <div
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--ink)",
            color: "var(--bg)",
            padding: "8px 12px",
            boxShadow: "0 6px 20px rgba(0,0,0,.25)",
          }}
        >
          <span
            style={{
              font: "600 var(--m-sm) var(--font-mono)",
              letterSpacing: "0.1em",
              color: "var(--brandink)",
            }}
          >
            ● {mode === "present" ? "PRESENT" : "FULLSCREEN"}
          </span>
          <button
            type="button"
            onClick={exitMode}
            style={{
              cursor: "pointer",
              fontSize: "var(--t-sm)",
              fontWeight: 700,
              border: "none",
              borderLeft: "1px solid rgba(255,255,255,.2)",
              paddingLeft: 10,
              background: "transparent",
              color: "inherit",
            }}
          >
            Exit ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
