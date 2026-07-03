"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { STATUS_LABEL, statusTone } from "@/features/solutions/schemas/solution";

import { useToggleFavorite } from "../api/hub";
import type { HubSolution } from "../server/queries";
import type { HubSort } from "../schemas/hub";
import {
  favoriteStarStyle,
  isOpenable,
  monoTileStyle,
  monogramOrFallback,
  typeLabel,
  updatedLabel,
} from "./solution-row";

/**
 * A solution row shared by the hub and favorites lists (prototype
 * `_demoRow`). Grid layout (≥920px): 2.4fr name · .8fr type · .8fr status ·
 * .6fr updated · 40px star; collapses to a stacked flex row below that.
 *
 * Clicking the row opens the viewer (`/s/[slug]`) when the solution is
 * openable (status !== draft). Non-openable rows are dimmed and non-clickable.
 * The favorite star toggles from the row without opening it (FR-HUB-08) — it
 * stops the row click and shows a pending state while the mutation is in flight.
 */
export function SolutionListRow({ solution, sort }: { solution: HubSolution; sort: HubSort }) {
  const openable = isOpenable(solution.status);
  const toggleFav = useToggleFavorite();
  const [justToggled, setJustToggled] = useState(false);

  const onToggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setJustToggled(true);
    toggleFav.mutate(
      { solutionId: solution.id },
      {
        onSettled: () => setJustToggled(false),
      },
    );
  };

  const cellStar = (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
      <button
        type="button"
        title={solution.isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={solution.isFavorite}
        aria-label={
          solution.isFavorite
            ? `Remove ${solution.name} from favorites`
            : `Add ${solution.name} to favorites`
        }
        onClick={onToggleFav}
        disabled={toggleFav.isPending && justToggled}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          ...(toggleFav.isPending && justToggled ? { opacity: 0.5 } : {}),
        }}
      >
        <span aria-hidden style={favoriteStarStyle(solution.isFavorite)}>
          {solution.isFavorite ? "★" : "☆"}
        </span>
      </button>
    </div>
  );

  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
        <span aria-hidden style={monoTileStyle(solution)}>
          {monogramOrFallback(solution.monogram, solution.name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--t-body)",
              fontWeight: 600,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {solution.name}
          </div>
          <div
            style={{
              fontSize: "var(--t-xs)",
              color: "var(--ink3)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {solution.description ?? ""}
          </div>
        </div>
      </div>
      <div style={{ font: "600 var(--m-md) var(--font-mono)", color: "var(--ink2)" }}>
        {typeLabel(solution.type)}
      </div>
      <div>
        <StatusBadge tone={statusTone(solution.status)} dot>
          {STATUS_LABEL[solution.status]}
        </StatusBadge>
      </div>
      <div
        className="cs-hide"
        style={{
          textAlign: "right",
          font: "500 var(--m-md) var(--font-mono)",
          color: "var(--ink3)",
        }}
      >
        {updatedLabel(solution, sort)}
      </div>
      {cellStar}
    </>
  );

  if (openable) {
    return (
      <Link
        href={`/s/${solution.slug}`}
        className="cs-trow csrow"
        aria-label={`Open ${solution.name}`}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      className="cs-trow csrow"
      aria-label={solution.name}
      aria-disabled="true"
      style={{ opacity: 0.55, cursor: "not-allowed" }}
    >
      {inner}
    </div>
  );
}
