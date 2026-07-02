"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CSSProperties } from "react";

import { ADMIN_NAV_ITEMS } from "../_lib/admin-nav-items";

/**
 * Admin console primary nav. Active selection matches the prototype exactly —
 * a 3px brand left-rule over a brandtint fill, brandink text at weight 700
 * (same recipe as the workspace shell's `WorkspaceNav`); inactive items carry
 * a transparent left-rule so the rule's horizontal alignment stays constant.
 */
const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 10px",
  fontSize: "var(--t-body)",
  cursor: "pointer",
};

function activeStyle(active: boolean): CSSProperties {
  return active
    ? {
        ...baseStyle,
        background: "var(--brandtint)",
        borderLeft: "3px solid var(--brand)",
        color: "var(--brandink)",
        fontWeight: 700,
      }
    : {
        ...baseStyle,
        borderLeft: "3px solid transparent",
        color: "var(--ink2)",
      };
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Admin console">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="adm-nav-item transition-colors"
            style={activeStyle(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
