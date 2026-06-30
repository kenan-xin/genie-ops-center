"use client";

import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

import { WorkspaceNav } from "./workspace-nav";

// Workspace shell. Above 920px: a persistent left sidebar. Below 920px (per the
// Ledger spec): the sidebar collapses to an off-canvas drawer with a hamburger
// and a scrim. The drawer state is purely client-side.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--bg)" }}>
      {/* Hamburger — mobile only (<920px). */}
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        className="ws-hamburger"
        style={{
          display: "none",
          position: "fixed",
          top: "0.75rem",
          left: "0.75rem",
          zIndex: 40,
          width: "40px",
          height: "40px",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        ☰
      </button>

      {/* Scrim — mobile only, shown when the drawer is open. */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="ws-scrim"
          style={{
            display: "none",
            position: "fixed",
            inset: "0",
            zIndex: 45,
            background: "rgba(8,10,14,0.45)",
            border: "none",
            cursor: "pointer",
          }}
        />
      ) : null}

      <aside
        className="ws-sidebar"
        data-open={drawerOpen ? "" : undefined}
        style={{
          width: "var(--sidebar-w)",
          background: "var(--sidebar)",
          borderRight: "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            font: "600 var(--m-md) var(--font-mono)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--chrome)",
            padding: "1.25rem 1rem 0",
          }}
        >
          Genie
        </div>
        <div style={{ padding: "1.5rem 1rem" }}>
          <WorkspaceNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between gap-3 px-6 py-3"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <span
            className="ws-header-label"
            style={{
              font: "600 var(--m-sm) var(--font-mono)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink3)",
            }}
          >
            Workspace
          </span>
          <ThemeToggle />
        </header>

        <main
          className="flex-1 px-6 py-8"
          style={{ maxWidth: "var(--content-wide)", width: "100%" }}
        >
          {children}
        </main>
      </div>

      {/* Responsive reflow. Below 920px: hide the in-flow sidebar, show the
          hamburger; render the sidebar as an off-canvas drawer over the scrim. */}
      <style>{`
        @media (max-width: 919px) {
          .ws-hamburger { display: inline-flex !important; }
          .ws-scrim { display: block !important; }
          .ws-header-label { margin-left: 3rem !important; }
          main { padding-left: 1rem !important; padding-right: 1rem !important; }
          .ws-sidebar {
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.18s cubic-bezier(.4,0,.2,1);
          }
          .ws-sidebar[data-open] { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ws-sidebar { transition: none; }
        }
      `}</style>
    </div>
  );
}
