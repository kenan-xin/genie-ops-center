"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";

import { IdleTimeout } from "@/components/idle-timeout";

import { AdminHeader } from "./admin-header";
import { AdminNav } from "./admin-nav";
import { AdminUserFooter } from "./admin-user-footer";
import { useAdminChromeStore } from "../_lib/admin-chrome-store";

/**
 * Admin console chrome — the client half of the server layout
 * (`(admin)/layout.tsx` owns the auth gate; this owns the chrome). New build
 * (audit §B admin — the shipped shell was a top-bar only); structured after
 * the customer workspace shell (ticket 10's `WorkspaceChrome`), minus the
 * PINNED-favorites rail and the viewer's chrome modes, neither of which apply
 * to admin.
 *
 * Layout (prototype "APP" block, lines 192-241): 212px sidebar ≥920px,
 * off-canvas 250px/max-84vw drawer + backdrop <920px, G-tile + GENIE wordmark,
 * ● ADMIN CONSOLE label, nav, bottom user footer, 54px route-aware header
 * with the hamburger inside it. Route changes close the mobile drawer so
 * navigation never strands it open.
 *
 * `<main>` keeps the padded/max-width wrapper the old top-bar shell had:
 * unlike the workspace hub/recent pages (which self-pad via `cs-hubpad`), the
 * admin feature pages (people/groups/solutions/themes directories) render
 * unpadded and rely on the shell for it — dropping this would leave them
 * flush against the chrome edges.
 */
export function AdminChrome({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const drawerOpen = useAdminChromeStore((s) => s.drawerOpen);
  const setDrawerOpen = useAdminChromeStore((s) => s.setDrawerOpen);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  return (
    <div
      className="adm-root"
      style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)" }}
    >
      <IdleTimeout />

      {/* Backdrop — mobile only, when the drawer is open. */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="adm-backdrop"
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

      {/* Sidebar: persistent ≥920px, off-canvas drawer <920px (CSS-driven). */}
      <aside
        className="adm-side"
        data-open={drawerOpen ? "" : undefined}
        style={{
          background: "var(--sidebar)",
          borderRight: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--ink)",
              color: "var(--bg)",
              padding: "4px 9px",
              font: "600 var(--m-xs) var(--font-mono)",
              letterSpacing: "0.1em",
              margin: "0 6px 12px",
            }}
          >
            ● ADMIN CONSOLE
          </div>
          <AdminNav />
        </div>
        <AdminUserFooter name={userName} />
      </aside>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "var(--bg)",
        }}
      >
        <AdminHeader />
        <main
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            padding: 24,
            maxWidth: "var(--content-wide)",
            width: "100%",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
