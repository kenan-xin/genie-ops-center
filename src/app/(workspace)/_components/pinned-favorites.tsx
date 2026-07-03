"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { CSSProperties } from "react";

import { useFavorites, useReorderFavorites } from "@/features/solutions-hub/api/hub";

/**
 * The "PINNED" favorites rail between the primary nav and the user footer
 * (prototype line 209–214): up to 6 favorites, drag-to-reorder, click to open.
 *
 * Self-fetches via `useFavorites()` (seeded by the workspace layout's
 * `prefetch` + `HydrateClient`) so starring/unstarring anywhere updates the
 * rail reactively — no server prop-threading, no `router.refresh()`. Drag-
 * reorder is optimistic (`useReorderFavorites`); only transient drag UI state
 * (`dragId`/`overId`) is local. The active item carries the same brand rule/
 * tint styling as the primary nav, so a pinned solution reads as current
 * while it's open in the viewer.
 */
const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  textAlign: "left",
  overflow: "hidden",
  padding: "8px 10px",
  fontSize: "var(--t-body)",
  cursor: "pointer",
};

function itemStyle(active: boolean, draggingOver: boolean, dragging: boolean): CSSProperties {
  return {
    ...baseStyle,
    ...(active
      ? {
          background: "var(--brandtint)",
          borderLeft: "3px solid var(--brand)",
          color: "var(--brandink)",
          fontWeight: 700,
        }
      : {
          borderLeft: "3px solid transparent",
          color: "var(--ink2)",
        }),
    ...(draggingOver ? { boxShadow: "inset 0 2px 0 var(--brand)" } : {}),
    ...(dragging ? { opacity: 0.4 } : {}),
  };
}

export function PinnedFavorites() {
  const pathname = usePathname();
  const { data } = useFavorites();
  const { mutate: reorderFavorites } = useReorderFavorites();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const pinned = (data ?? []).slice(0, 6);

  if (pinned.length === 0) return null;

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const from = pinned.findIndex((f) => f.id === dragId);
    const to = pinned.findIndex((f) => f.id === targetId);
    if (from !== -1 && to !== -1) {
      const next = pinned.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      reorderFavorites({ orderedSolutionIds: next.map((f) => f.id) });
    }
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="flex flex-col">
      <div
        style={{
          font: "600 var(--m-sm) var(--font-mono)",
          letterSpacing: "0.13em",
          color: "var(--ink3)",
          padding: "16px 6px 8px",
        }}
      >
        PINNED
      </div>
      {pinned.map((f) => {
        const active = pathname === `/s/${f.slug}`;
        return (
          <Link
            key={f.id}
            href={`/s/${f.slug}`}
            draggable
            onDragStart={() => setDragId(f.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(f.id);
            }}
            onDrop={() => handleDrop(f.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            aria-current={active ? "page" : undefined}
            style={itemStyle(
              active,
              overId === f.id && dragId !== null && dragId !== f.id,
              dragId === f.id,
            )}
          >
            <span
              aria-hidden
              style={{
                color: "var(--ink3)",
                cursor: "grab",
                flexShrink: 0,
                fontSize: "var(--m-sm)",
                letterSpacing: "-1px",
              }}
            >
              ⠿⠿
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {f.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
