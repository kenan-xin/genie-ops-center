"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Hub" },
  { href: "/recent", label: "Recent" },
  { href: "/favorites", label: "Favorites" },
  { href: "/account", label: "Account" },
];

export function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="px-3 py-2 transition-colors"
            style={{
              fontSize: "var(--t-sm)",
              fontWeight: active ? 600 : 500,
              // Brand blue is reserved for the current selection.
              color: active ? "var(--brand)" : "var(--ink2)",
              background: active ? "var(--brandtint)" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
