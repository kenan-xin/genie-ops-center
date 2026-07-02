"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CSSProperties } from "react";

/**
 * Primary workspace nav. Production labels per the prototype / epic-brief deltas:
 * the hub is "Solutions" (not "Hub"/"Demo Hub"), no admin affordances leak in.
 *
 * Active selection matches the prototype exactly — a 3px brand left-rule over a
 * brandtint fill, brandink text at weight 700; inactive items carry a transparent
 * left-rule so the rule's horizontal alignment stays constant.
 */
const ITEMS = [
  { href: "/", label: "Solutions", exact: true },
  { href: "/recent", label: "Recent", exact: false },
  { href: "/favorites", label: "Favorites", exact: false },
  { href: "/account", label: "Account", exact: false },
] as const;

const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
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

export function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Workspace">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="ws-nav-item transition-colors"
            style={activeStyle(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
