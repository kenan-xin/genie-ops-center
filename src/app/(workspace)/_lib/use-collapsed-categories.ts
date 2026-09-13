"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  // Mirrors `collapsed` so rapid toggles always read the current value, not
  // the stale one captured by the render that built the callback.
  const collapsedRef = useRef<Set<string>>(collapsed);

  useEffect(() => {
    const stored = parseCollapsed(window.localStorage.getItem(COLLAPSED_KEY));
    collapsedRef.current = stored;
    setCollapsed(stored);
  }, []);

  // The write happens OUTSIDE the state updater. A `setState` updater must stay
  // pure: React can call it twice under StrictMode, or discard the render.
  // Reads `collapsedRef.current`, so two rapid toggles compose instead of both
  // computing from the same stale snapshot.
  const toggle = useCallback((id: string) => {
    const next = new Set(collapsedRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedRef.current = next;
    window.localStorage.setItem(COLLAPSED_KEY, serialiseCollapsed(next));
    setCollapsed(next);
  }, []);

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed]);

  return { isCollapsed, toggle };
}
