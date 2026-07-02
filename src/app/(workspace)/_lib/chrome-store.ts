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
 *  - chrome modes (FR-VIEW-06): `sidebarHidden` / `headerHidden` / `presenting`.
 *    The default chrome shows sidebar + header. `standalone` hides both (the
 *    viewer edge-to-edge); `present` is full-screen. Each is reversible via the
 *    floating Exit control. The viewer (ticket 12) drives these on its solution
 *    routes; the shell exposes the toggle so modes are usable app-wide.
 */
export type ChromeMode = "default" | "standalone" | "present";

type WorkspaceChromeState = {
  drawerOpen: boolean;
  offline: boolean;
  mode: ChromeMode;
  setDrawerOpen: (open: boolean) => void;
  setOffline: (offline: boolean) => void;
  setMode: (mode: ChromeMode) => void;
  /** Reversible: any non-default mode returns to the default chrome. */
  exitMode: () => void;
};

export const useWorkspaceChromeStore = create<WorkspaceChromeState>()(
  devtools(
    (set) => ({
      drawerOpen: false,
      offline: false,
      mode: "default",
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      setOffline: (offline) => set({ offline }),
      setMode: (mode) => set({ mode }),
      exitMode: () => set({ mode: "default" }),
    }),
    { name: "workspace-chrome", enabled: process.env.NODE_ENV !== "production" },
  ),
);
