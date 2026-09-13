"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CSSProperties } from "react";

import { useSidebarEntries } from "@/features/categories/api/categories";
import type { SidebarEntry } from "@/features/categories/schemas/category";

import { useCollapsedCategories } from "../_lib/use-collapsed-categories";

type CategoryEntry = Extract<SidebarEntry, { kind: "category" }>;
type SolutionEntry = Extract<SidebarEntry, { kind: "solution" }>;

// Explicit type predicates: a plain `.filter(e => e.kind === "category")` still
// returns SidebarEntry[], so `entry.category` below would not type-check.
const isCategoryEntry = (e: SidebarEntry): e is CategoryEntry => e.kind === "category";
const isSolutionEntry = (e: SidebarEntry): e is SolutionEntry => e.kind === "solution";

/**
 * Admin categories and standalone solutions, below the PINNED rail.
 *
 * A category name and a standalone solution name start at the same x position,
 * so the caret sits on the RIGHT. A caret on the left would indent every
 * category by one disclosure slot and break the column.
 *
 * The server decides what appears here: `categories.sidebar` returns only the
 * solutions this user is granted, and only the categories that hold at least
 * one of them. This component adds no filtering of its own.
 */
const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "8px 10px",
  fontSize: "var(--t-body)",
  cursor: "pointer",
  textAlign: "left",
  borderLeft: "3px solid transparent",
  color: "var(--ink2)",
};

function linkStyle(active: boolean): CSSProperties {
  return active
    ? {
        ...rowBase,
        background: "var(--brandtint)",
        borderLeftColor: "var(--brand)",
        color: "var(--brandink)",
        fontWeight: 700,
      }
    : rowBase;
}

const dividerStyle: CSSProperties = {
  height: 1,
  background: "var(--line2)",
  margin: "14px 6px 10px",
};

const clampStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export function SidebarCategories() {
  const pathname = usePathname();
  const { data } = useSidebarEntries();
  const { isCollapsed, toggle } = useCollapsedCategories();

  const entries = data ?? [];
  if (entries.length === 0) return null;

  const categories = entries.filter(isCategoryEntry);
  const standalone = entries.filter(isSolutionEntry);

  return (
    <div className="flex flex-col">
      <div style={dividerStyle} />

      {categories.map((entry) => {
        const c = entry.category;
        const collapsed = isCollapsed(c.id);
        return (
          <div key={c.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(c.id)}
              aria-expanded={!collapsed}
              style={{
                ...rowBase,
                background: "none",
                borderTop: 0,
                borderRight: 0,
                borderBottom: 0,
              }}
            >
              <span style={{ ...clampStyle, flex: 1 }}>{c.name}</span>
              <span style={{ font: "600 var(--m-sm) var(--font-mono)", color: "var(--ink3)" }}>
                {c.solutions.length}
              </span>
              <span
                aria-hidden
                style={{
                  color: "var(--ink3)",
                  fontSize: "var(--m-sm)",
                  transition: "transform var(--dur-fast) var(--ease)",
                  transform: collapsed ? "rotate(-90deg)" : "none",
                }}
              >
                ▾
              </span>
            </button>

            {collapsed
              ? null
              : c.solutions.map((s) => {
                  const active = pathname === `/s/${s.slug}`;
                  return (
                    <Link
                      key={s.id}
                      href={`/s/${s.slug}`}
                      aria-current={active ? "page" : undefined}
                      style={{
                        ...linkStyle(active),
                        marginLeft: 10,
                        width: "calc(100% - 10px)",
                        fontSize: "var(--t-sm)",
                      }}
                    >
                      <span style={clampStyle}>{s.name}</span>
                    </Link>
                  );
                })}
          </div>
        );
      })}

      {standalone.length > 0 && categories.length > 0 ? <div style={dividerStyle} /> : null}

      {standalone.map((entry) => {
        const s = entry.solution;
        const active = pathname === `/s/${s.slug}`;
        return (
          <Link
            key={s.id}
            href={`/s/${s.slug}`}
            aria-current={active ? "page" : undefined}
            style={linkStyle(active)}
          >
            <span style={clampStyle}>{s.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
