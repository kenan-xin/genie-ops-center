"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Workspace chrome state — client/UI state only (per AGENTS.md: zustand for
 * complex UI state, wrapped in `devtools` for dev). No server data lives here.
 *
 * Owns three independent concerns:
 *  - `drawerOpen`: the off-canvas mobile nav (<920px). Route navigation closes it.
 *  - `offline`: the FR-VIEW-07 connection banner, driven by real online/offline
 *    window events (wired in `OfflineIndicator`).
 *  - `sidebarHidden`: the viewer's `▤` control (FR-VIEW-06) — collapses just the
 *    sidebar while keeping the header + content. The viewer toggles this; route
 *    navigation resets it (so a fresh route never opens with a hidden sidebar).
 *  - chrome modes (FR-VIEW-06): `standalone` hides sidebar + header (the viewer
 *    edge-to-edge); `present` is full-screen. Each is reversible via the floating
 *    Exit control. The viewer (ticket 12) drives these on its solution routes;
 *    the shell exposes the toggle so modes are usable app-wide.
 */
export type ChromeMode = "default" | "standalone" | "present";

type WorkspaceChromeState = {
  drawerOpen: boolean;
  offline: boolean;
  /** Viewer-only: collapse the sidebar without entering a chrome mode. */
  sidebarHidden: boolean;
  mode: ChromeMode;
  setDrawerOpen: (open: boolean) => void;
  setOffline: (offline: boolean) => void;
  setSidebarHidden: (hidden: boolean) => void;
  setMode: (mode: ChromeMode) => void;
  /** Reversible: any non-default mode returns to the default chrome. */
  exitMode: () => void;
};

export const useWorkspaceChromeStore = create<WorkspaceChromeState>()(
  devtools(
    (set) => ({
      drawerOpen: false,
      offline: false,
      sidebarHidden: false,
      mode: "default",
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      setOffline: (offline) => set({ offline }),
      setSidebarHidden: (sidebarHidden) => set({ sidebarHidden }),
      setMode: (mode) => set({ mode }),
      exitMode: () => set({ mode: "default" }),
    }),
    { name: "workspace-chrome", enabled: process.env.NODE_ENV !== "production" },
  ),
);
