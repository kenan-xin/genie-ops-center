"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";

import { useHubSolutions, useRecents } from "../api/hub";
import type { HubSolution } from "../server/queries";
import type { HubSort, HubTypeFilter } from "../schemas/hub";
import { SolutionListRow } from "./solution-list-row";

/**
 * Customer Solutions hub (FR-HUB-01..09), lifted from the prototype's "DEMO
 * HUB" block. Two states: the no-access empty state (no granted solutions) and
 * the catalogue. The catalogue is: an intro line, a search/type/sort toolbar
 * with a live "N OF M SHOWN" counter, a bordered list with a column header +
 * progressive-loading rows + a load-more row + a filter-empty state, and a
 * side rail (≥1180px) surfacing the 4 most-recent solutions.
 *
 * Progressive loading: start at 5, extend by 4 via the "LOAD MORE" row and
 * automatically when the scroll container nears its bottom (48px). Filters and
 * sort reset the limit to 5. Search/type filter client-side over the full
 * granted set; sort mirrors the prototype (recent / name / status).
 */

const INITIAL_LIMIT = 5;
const PAGE_SIZE = 4;
const EMPTY: HubSolution[] = [];

const TYPE_FILTERS: { value: HubTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "embedded", label: "Embedded" },
];

const SORTS: { value: HubSort; label: string }[] = [
  { value: "recent", label: "Recently opened" },
  { value: "name", label: "Name (A–Z)" },
  { value: "status", label: "Status" },
];

export function SolutionsHub() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<HubTypeFilter>("all");
  const [sort, setSort] = useState<HubSort>("recent");
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  // Sort is server-side (the query refetches when it changes); search and type
  // filter client-side over the full granted set so they're instant.
  const { data, isPending } = useHubSolutions({ sort });
  const allSolutions = data ?? EMPTY;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSolutions.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allSolutions, search, typeFilter]);

  const visible = filtered.slice(0, limit);
  const hasAny = allSolutions.length > 0;

  // Auto-load on scroll-near-bottom (FR-HUB-05). The workspace chrome wraps this
  // page in <main style="overflow:auto">, so walk up to that scroll container.
  const filteredCount = filtered.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let node: HTMLElement | null = el;
    while (node && getComputedStyle(node).overflowY !== "auto") {
      node = node.parentElement;
    }
    const scroller = node ?? el;
    const onScroll = () => {
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 48) {
        setLimit((cur) => Math.min(filteredCount, cur + PAGE_SIZE));
      }
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [filteredCount]);

  const resetLimit = (fn: () => void) => {
    fn();
    setLimit(INITIAL_LIMIT);
  };

  const clearFilters = () =>
    resetLimit(() => {
      setSearch("");
      setTypeFilter("all");
      setSort("recent");
    });

  if (isPending) return <HubSkeleton />;
  if (!hasAny) return <NoAccess />;

  return (
    <div
      ref={scrollRef}
      className="cs-hubpad"
      style={{ padding: 24, maxWidth: "var(--content-wide)" }}
    >
      <div style={{ maxWidth: 600 }}>
        <p
          style={{ margin: 0, fontSize: "var(--t-title)", color: "var(--ink2)", lineHeight: 1.55 }}
        >
          Open any solution to try it live.
        </p>
      </div>

      <div className="cs-hubgrid" style={{ marginTop: 20, alignItems: "start" }}>
        <div>
          {/* Toolbar: search · type segmented · sort · "N OF M SHOWN" counter */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                flex: 1,
                maxWidth: 300,
                height: 34,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 11px",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 13,
                  height: 13,
                  border: "1.5px solid var(--ink3)",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
              <input
                value={search}
                onChange={(e) => resetLimit(() => setSearch(e.target.value))}
                placeholder="Search solutions…"
                aria-label="Search solutions"
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "var(--t-body)",
                  color: "var(--ink)",
                  width: "100%",
                }}
              />
            </div>
            <SegmentedControl
              options={TYPE_FILTERS}
              value={typeFilter}
              onValueChange={(v) => resetLimit(() => setTypeFilter(v))}
              aria-label="Filter by type"
            />
            <SortSelect value={sort} onChange={(v) => resetLimit(() => setSort(v))} />
            <div
              style={{
                font: "500 var(--m-md) var(--font-mono)",
                color: "var(--ink3)",
                marginLeft: "auto",
              }}
            >
              {Math.min(limit, filtered.length)} OF {filtered.length} SHOWN
            </div>
          </div>

          {/* List */}
          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            <div
              className="cs-thead"
              style={{
                gridTemplateColumns: "2.4fr .8fr .8fr .6fr 40px",
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
                background: "var(--panel)",
                font: "600 var(--m-xs) var(--font-mono)",
                letterSpacing: "0.07em",
                color: "var(--ink2)",
              }}
            >
              <span>SOLUTION</span>
              <span>TYPE</span>
              <span>STATUS</span>
              <span style={{ textAlign: "right" }}>UPDATED</span>
              <span />
            </div>

            {visible.map((s) => (
              <SolutionListRow key={s.id} solution={s} sort={sort} />
            ))}

            {filtered.length === 0 ? <FilterEmpty onClear={clearFilters} /> : null}

            {limit < filtered.length ? (
              <button
                type="button"
                onClick={() => setLimit((cur) => Math.min(filtered.length, cur + PAGE_SIZE))}
                className="csrow"
                style={{
                  width: "100%",
                  padding: "13px 16px",
                  textAlign: "center",
                  font: "600 var(--m-sm) var(--font-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--brandink)",
                  borderTop: "1px solid var(--line2)",
                  cursor: "pointer",
                  background: "transparent",
                  borderLeft: "none",
                  borderRight: "none",
                  borderBottom: "none",
                }}
              >
                ↓ LOAD MORE
              </button>
            ) : null}
          </div>
        </div>

        <RecentRail />
      </div>
    </div>
  );
}

function HubSkeleton() {
  return (
    <div className="cs-hubpad" style={{ padding: 24, maxWidth: "var(--content-wide)" }}>
      <Skeleton style={{ height: 28, width: 320 }} />
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} style={{ height: 56, width: "100%" }} />
        ))}
      </div>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: HubSort; onChange: (v: HubSort) => void }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as HubSort)}
        aria-label="Sort solutions"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
          borderRadius: 0,
          padding: "0 32px 0 12px",
          height: 34,
          fontSize: "var(--t-sm)",
        }}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: "5px solid var(--ink3)",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}

/** Side rail: up to 4 most-recent solutions (FR-HUB-09). */
function RecentRail() {
  const { data } = useRecents();
  const recents = (data ?? []).slice(0, 4);
  if (recents.length === 0) return null;

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
        <div
          style={{
            padding: "9px 14px",
            borderBottom: "1px solid var(--line)",
            background: "var(--panel)",
            font: "600 var(--m-xs) var(--font-mono)",
            letterSpacing: "0.08em",
            color: "var(--ink2)",
          }}
        >
          RECENTLY OPENED
        </div>
        {recents.map((r) => (
          <RecentRailRow key={r.id} solution={r} />
        ))}
      </div>
    </aside>
  );
}

function RecentRailRow({ solution }: { solution: HubSolution }) {
  return (
    <Link
      href={`/s/${solution.slug}`}
      className="csrow"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid var(--line2)",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          background: "var(--panel)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 10,
        }}
      >
        {solution.monogram ?? solution.name.slice(0, 2)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--t-sm)",
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {solution.name}
        </div>
        <div style={{ font: "500 var(--m-xs) var(--font-mono)", color: "var(--ink3)" }}>
          {solution.type === "embedded" ? "EMBED" : solution.type.toUpperCase()}
        </div>
      </div>
    </Link>
  );
}

/** FR-HUB-01: granted set is empty. */
function NoAccess() {
  return (
    <div className="cs-hubpad" style={{ padding: 24, maxWidth: "var(--content-wide)" }}>
      <div
        style={{
          maxWidth: 520,
          margin: "40px auto 0",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: "40px 34px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            border: "1.5px dashed var(--line)",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink3)",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--t-cardhead)",
          }}
        >
          ∅
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--t-h3)",
            color: "var(--ink)",
            marginTop: 16,
            letterSpacing: "-0.01em",
          }}
        >
          No solutions yet
        </div>
        <p
          style={{
            fontSize: "var(--t-body)",
            color: "var(--ink2)",
            marginTop: 8,
            lineHeight: 1.55,
          }}
        >
          You don&apos;t have access to any solutions right now. Access is granted by your workspace
          administrator — once you&apos;re added to a group, your solutions appear here.
        </p>
        <div
          style={{
            font: "500 var(--m-md) var(--font-mono)",
            color: "var(--ink3)",
            marginTop: 18,
            letterSpacing: "0.06em",
          }}
        >
          CONTACT YOUR WORKSPACE ADMIN TO REQUEST ACCESS
        </div>
      </div>
    </div>
  );
}

/** FR-HUB-06: filters exclude everything. */
function FilterEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div style={{ padding: "48px 20px", textAlign: "center" }}>
      <div
        style={{
          width: 46,
          height: 46,
          border: "1.5px dashed var(--line)",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink3)",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
        }}
      >
        ∅
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "var(--t-title)",
          color: "var(--ink)",
          marginTop: 14,
        }}
      >
        No solutions match your filters
      </div>
      <div style={{ fontSize: "var(--t-sm)", color: "var(--ink2)", marginTop: 5 }}>
        Try a different search term or clear the filters.
      </div>
      <button
        type="button"
        onClick={onClear}
        style={{
          marginTop: 14,
          height: 32,
          padding: "0 14px",
          border: "1px solid var(--line)",
          background: "transparent",
          fontWeight: 600,
          fontSize: "var(--t-sm)",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        Clear filters
      </button>
    </div>
  );
}
