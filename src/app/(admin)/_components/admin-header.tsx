"use client";

import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

import { useAdminChromeStore } from "../_lib/admin-chrome-store";
import { ADMIN_NAV_ITEMS } from "../_lib/admin-nav-items";

/**
 * The 54px route-aware header (prototype line 235-249, mirrors the workspace
 * shell's `WorkspaceHeader`). Left: hamburger (opens the off-canvas drawer;
 * shown only <920px via CSS), page title derived from the current admin nav
 * item. Right: theme toggle.
 */
function titleFor(pathname: string): string {
  // Account is reached from the footer profile, not the nav — so it has no
  // ADMIN_NAV_ITEMS entry to derive a title from.
  if (pathname.startsWith("/admin/account")) return "Account";
  return ADMIN_NAV_ITEMS.find((item) => item.isActive(pathname))?.label ?? "Admin";
}

export function AdminHeader() {
  const pathname = usePathname();
  const setDrawerOpen = useAdminChromeStore((s) => s.setDrawerOpen);

  return (
    <div
      className="adm-header"
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
          className="adm-burger"
          style={{
            // display is owned by `.adm-burger` in globals.css (inline-flex <920px,
            // none ≥920px) — do NOT set it inline here, or it beats the media query
            // (the same bug the Phase-3 review flagged on the workspace shell).
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
