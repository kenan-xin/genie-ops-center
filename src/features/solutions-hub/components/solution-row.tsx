"use client";

import type { CSSProperties } from "react";

import type { HubSolution } from "../server/queries";
import type { HubSort } from "../schemas/hub";

/**
 * Presentation helpers shared by the hub, recents, and favorites rows — all
 * three render the same solution shape (lifted from the prototype's `_demoRow` /
 * `statusMeta` / `iconColors`). The monogram tile is ink-on-panel (the
 * prototype's `iconColors`), status leads with a ● dot on its semantic tint,
 * and the favorite star toggles without opening the row.
 */

export function monogramOrFallback(mono: string | null, name: string): string {
  if (mono && mono.trim()) return mono.trim().slice(0, 2).toUpperCase();
  const letters = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (letters[0] ?? "?") + (letters[1] ?? "");
}

/** `EMBED` for embedded, else the uppercased type — matches the prototype. */
export function typeLabel(type: HubSolution["type"]): string {
  return type === "embedded" ? "EMBED" : type.toUpperCase();
}

/** The prototype sorts hub rows; the UPDATED column shows the relevant stamp. */
export function updatedLabel(s: HubSolution, sort: HubSort): string {
  // For the recents sort the "updated" column reads as last-opened; otherwise
  // it reads as the solution's last edit. Both fall back to relative phrasing.
  const when = sort === "recent" ? (s.lastOpenedAt ?? s.updatedAt) : s.updatedAt;
  if (!when) return "—";
  return relativeTimeShort(when);
}

function relativeTimeShort(when: string): string {
  const abs = Math.abs(new Date(when).getTime() - Date.now());
  const min = Math.round(abs / 60_000);
  const hr = Math.round(abs / 3_600_000);
  const day = Math.round(abs / 86_400_000);
  if (abs < 3_600_000) return `${min}m`;
  if (abs < 86_400_000) return `${hr}h`;
  return `${day}d`;
}

export const MONO_TILE: CSSProperties = {
  width: 30,
  height: 30,
  flexShrink: 0,
  background: "var(--panel)",
  color: "var(--ink)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 800,
  fontSize: "var(--t-xs)",
};

/**
 * Per-row mono tile style: spreads {@link MONO_TILE} then overrides the
 * background/text with the solution's accent colors when set, falling back to
 * the neutral `--panel`/`--ink` tokens. `MONO_TILE` stays exported as the
 * shared neutral base this helper spreads; per-row accenting lives here.
 */
export function monoTileStyle(solution: HubSolution): CSSProperties {
  return {
    ...MONO_TILE,
    background: solution.accentColor ?? "var(--panel)",
    color: solution.accentColorInvert ?? "var(--ink)",
  };
}

/** `true` when the row opens the viewer (status !== draft). Drafts are hidden
 *  from customers by the predicate, but maintenance/down rows ARE openable —
 *  the viewer shows a notice (FR-ADM-S-05). */
export function isOpenable(status: HubSolution["status"]): boolean {
  return status !== "draft";
}

export function favoriteStarStyle(isFavorite: boolean): CSSProperties {
  return {
    fontSize: "var(--t-title)",
    lineHeight: 1,
    color: isFavorite ? "var(--warn)" : "var(--ink3)",
    cursor: "pointer",
    padding: "2px 0",
  };
}
