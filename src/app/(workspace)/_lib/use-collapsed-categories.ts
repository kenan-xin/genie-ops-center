"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Which categories the user has collapsed. The category itself is admin-owned,
 * but the open-and-closed state belongs to the user, so it lives on the device.
 *
 * `localStorage` is the right fidelity here: this is a per-device preference,
 * not shared data. Moving it to the server later is one import.
 */
export const COLLAPSED_KEY = "genie.sidebar.collapsedCategories";

/** Tolerates every malformed value — a bad key must never break the sidebar. */
export function parseCollapsed(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    if (!parsed.every((id) => typeof id === "string")) return new Set();
    return new Set(parsed as string[]);
  } catch {
    return new Set();
  }
}

export function serialiseCollapsed(ids: Set<string>): string {
  return JSON.stringify([...ids]);
}

export function useCollapsedCategories() {
  // Start empty so the server render and the first client render agree; the
  // stored value arrives in the effect below. Every category starts expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCollapsed(parseCollapsed(window.localStorage.getItem(COLLAPSED_KEY)));
  }, []);

  // The write happens OUTSIDE the state updater. A `setState` updater must stay
  // pure: React can call it twice under StrictMode, or discard the render.
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(COLLAPSED_KEY, serialiseCollapsed(next));
      setCollapsed(next);
    },
    [collapsed],
  );

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed]);

  return { isCollapsed, toggle };
}
