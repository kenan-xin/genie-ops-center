"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Admin chrome state — just the off-canvas mobile drawer (<920px). Route
 * navigation closes it. Unlike the workspace shell (`chrome-store.ts`), admin
 * has no offline banner, no viewer chrome modes, and no sidebar-only
 * collapse, so this store stays intentionally small.
 *
 * A store (not prop-drilled `useState`) sidesteps the Next.js "use client"
 * entry-file rule that flags function props as needing to be Server Actions —
 * the same reason the workspace shell's header reads off its store instead of
 * taking an `onOpenNav` callback.
 */
type AdminChromeState = {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

export const useAdminChromeStore = create<AdminChromeState>()(
  devtools(
    (set) => ({
      drawerOpen: false,
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    }),
    { name: "admin-chrome", enabled: process.env.NODE_ENV !== "production" },
  ),
);
