"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TransferItem = {
  id: string;
  label: string;
  description?: string;
  /** Short (1-3 char) tile glyph, e.g. initials or a type abbreviation. Falls back to the label's initials. */
  mono?: string;
};

function initials(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

type SideProps = {
  heading: string;
  items: TransferItem[];
  selected: Set<string>;
  query: string;
  onQuery: (q: string) => void;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  variant: "available" | "target";
  bulkLabel: string;
  onBulkAction: () => void;
  paneHeightClassName: string;
  onHeaderAction?: (filteredIds: string[]) => void;
  headerActionLabel?: string;
};

function matches(item: TransferItem, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.label.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false)
  );
}

function TransferSide({
  heading,
  items,
  selected,
  query,
  onQuery,
  onToggle,
  onToggleAll,
  variant,
  bulkLabel,
  onBulkAction,
  paneHeightClassName,
  onHeaderAction,
  headerActionLabel,
}: SideProps) {
  const filtered = items.filter((item) => matches(item, query));
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const isTarget = variant === "target";

  return (
    <div className="flex min-w-0 flex-col rounded-none border border-[var(--line)] bg-[var(--surface)]">
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-[var(--line2)] px-3 py-2",
          isTarget ? "bg-[var(--brandtint)]" : "bg-[var(--panel)]",
        )}
      >
        <span
          className={cn(
            "font-mono text-mono-xs font-semibold tracking-[0.1em] uppercase",
            isTarget ? "text-[var(--brand)]" : "text-[var(--ink2)]",
          )}
        >
          {heading} &middot; {items.length}
        </span>
        {onHeaderAction && (isTarget ? items.length > 0 : filtered.length > 0) ? (
          <button
            type="button"
            onClick={() => onHeaderAction(filtered.map((i) => i.id))}
            className={cn(
              "shrink-0 text-small font-semibold whitespace-nowrap transition-colors hover:text-[var(--ink)]",
              isTarget ? "text-[var(--ink2)]" : "text-[var(--brandink)]",
            )}
          >
            {headerActionLabel}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-b border-[var(--line2)] p-2">
        <input
          type="checkbox"
          aria-label={`Select all ${heading}`}
          className="size-4 accent-[var(--brand)]"
          checked={allSelected}
          onChange={() => onToggleAll(filtered.map((i) => i.id))}
        />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search…"
          className="h-8"
        />
      </div>
      <ul className={cn(paneHeightClassName, "overflow-y-auto")}>
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-small text-[var(--ink3)]">No items.</li>
        ) : (
          filtered.map((item) => {
            const active = selected.has(item.id);
            const mono = item.mono ?? initials(item.label);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b border-[var(--line2)] px-3 py-2 text-left outline-none transition-colors last:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active ? "bg-[var(--brandtint)]" : "hover:bg-[var(--panel)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center border text-mono-xs leading-none",
                      active
                        ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                        : "border-[var(--line)] bg-transparent",
                    )}
                  >
                    {active ? "✓" : ""}
                  </span>
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center bg-[var(--panel)] font-sans text-mono-xs font-extrabold text-foreground"
                  >
                    {mono}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate text-small font-medium",
                        active ? "text-[var(--brand)]" : "text-foreground",
                      )}
                    >
                      {item.label}
                    </span>
                    {item.description ? (
                      <span className="truncate text-mono-xs text-[var(--ink3)]">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {selected.size > 0 ? (
        <div className="border-t border-[var(--line)] p-2">
          <Button
            type="button"
            variant={isTarget ? "destructive" : "primary"}
            size="sm"
            className="w-full"
            onClick={onBulkAction}
          >
            {bulkLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Generic Available ⇄ target transfer list — multi-select, select-all and
 * per-side search, with per-bucket bulk actions ("Add N →" / "Revoke N").
 * Controlled: `value` is the set of ids on the target side.
 * Reused by Groups↔Solutions and Groups↔Members (ticket 07).
 */
export function TransferList({
  items,
  value,
  onChange,
  availableLabel = "Available",
  targetLabel = "Granted",
  className,
  paneHeightClassName = "h-[clamp(380px,52vh,640px)]",
  showHeaderActions = true,
}: {
  items: TransferItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  availableLabel?: string;
  targetLabel?: string;
  className?: string;
  paneHeightClassName?: string;
  /**
   * Header quick-links ("Add all shown →" / "Revoke all", AG-05). Prototype
   * only draws these on the Access · Grants list — the group-inspector
   * Members list omits them — so callers that must not show them (the
   * inspector) pass `false`.
   */
  showHeaderActions?: boolean;
}) {
  const [availableSelected, setAvailableSelected] = useState<Set<string>>(new Set());
  const [targetSelected, setTargetSelected] = useState<Set<string>>(new Set());
  const [availableQuery, setAvailableQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");

  const valueSet = useMemo(() => new Set(value), [value]);
  const availableItems = items.filter((item) => !valueSet.has(item.id));
  const targetItems = items.filter((item) => valueSet.has(item.id));

  function toggle(setState: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(setState: React.Dispatch<React.SetStateAction<Set<string>>>, ids: string[]) {
    setState((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allOn) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }

  function moveToTarget() {
    // Prune the selection against what's actually still available, then dedupe —
    // a controlled value change can otherwise leave stale ids in the selection
    // set and produce duplicates in the emitted value.
    const ids = [...availableSelected].filter((id) => !valueSet.has(id));
    if (ids.length === 0) return;
    onChange(Array.from(new Set([...value, ...ids])));
    setAvailableSelected(new Set());
  }

  function moveToAvailable() {
    if (targetSelected.size === 0) return;
    const remove = new Set(targetSelected);
    onChange(value.filter((id) => !remove.has(id)));
    setTargetSelected(new Set());
  }

  function addAllShown(ids: string[]) {
    const add = ids.filter((id) => !valueSet.has(id));
    if (add.length === 0) return;
    onChange(Array.from(new Set([...value, ...add])));
    setAvailableSelected(new Set());
  }

  function revokeAll() {
    if (value.length === 0) return;
    onChange([]);
    setTargetSelected(new Set());
  }

  return (
    <div className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2", className)}>
      <TransferSide
        heading={availableLabel}
        items={availableItems}
        selected={availableSelected}
        query={availableQuery}
        onQuery={setAvailableQuery}
        onToggle={(id) => toggle(setAvailableSelected, id)}
        onToggleAll={(ids) => toggleAll(setAvailableSelected, ids)}
        variant="available"
        bulkLabel={`Add ${availableSelected.size} →`}
        onBulkAction={moveToTarget}
        paneHeightClassName={paneHeightClassName}
        onHeaderAction={showHeaderActions ? addAllShown : undefined}
        headerActionLabel="Add all shown →"
      />
      <TransferSide
        heading={targetLabel}
        items={targetItems}
        selected={targetSelected}
        query={targetQuery}
        onQuery={setTargetQuery}
        onToggle={(id) => toggle(setTargetSelected, id)}
        onToggleAll={(ids) => toggleAll(setTargetSelected, ids)}
        variant="target"
        bulkLabel={`Revoke ${targetSelected.size}`}
        onBulkAction={moveToAvailable}
        paneHeightClassName={paneHeightClassName}
        onHeaderAction={showHeaderActions ? () => revokeAll() : undefined}
        headerActionLabel="Revoke all"
      />
    </div>
  );
}
