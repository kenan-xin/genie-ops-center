"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TransferItem = {
  id: string;
  label: string;
  description?: string;
};

type SideProps = {
  heading: string;
  items: TransferItem[];
  selected: Set<string>;
  query: string;
  onQuery: (q: string) => void;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
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
}: SideProps) {
  const filtered = items.filter((item) => matches(item, query));
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  return (
    <div className="flex min-w-0 flex-col rounded-none border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line2)] bg-[var(--panel)] px-3 py-2">
        <span className="font-mono text-mono-xs font-semibold tracking-[0.1em] text-[var(--ink2)] uppercase">
          {heading}
        </span>
        <span className="font-mono text-mono-xs text-[var(--ink3)]">
          {selected.size} / {items.length}
        </span>
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
      <ul className="max-h-64 min-h-32 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-small text-[var(--ink3)]">No items.</li>
        ) : (
          filtered.map((item) => {
            const active = selected.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(item.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-[var(--line2)] px-3 py-2 text-left outline-none transition-colors last:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active
                      ? "bg-[var(--brandtint)] text-[var(--brand)]"
                      : "hover:bg-[var(--panel)]",
                  )}
                >
                  <span className="text-small font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="text-mono-xs text-[var(--ink3)]">{item.description}</span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/**
 * Generic Available ⇄ target transfer list — multi-select, select-all and
 * per-side search. Controlled: `value` is the set of ids on the target side.
 * Reused by Groups↔Solutions and Groups↔Members (ticket 07).
 */
export function TransferList({
  items,
  value,
  onChange,
  availableLabel = "Available",
  targetLabel = "Granted",
  className,
}: {
  items: TransferItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  availableLabel?: string;
  targetLabel?: string;
  className?: string;
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

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center",
        className,
      )}
    >
      <TransferSide
        heading={availableLabel}
        items={availableItems}
        selected={availableSelected}
        query={availableQuery}
        onQuery={setAvailableQuery}
        onToggle={(id) => toggle(setAvailableSelected, id)}
        onToggleAll={(ids) => toggleAll(setAvailableSelected, ids)}
      />
      <div className="flex flex-row justify-center gap-2 sm:flex-col">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Move to ${targetLabel}`}
          disabled={availableSelected.size === 0}
          onClick={moveToTarget}
        >
          →
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Move to ${availableLabel}`}
          disabled={targetSelected.size === 0}
          onClick={moveToAvailable}
        >
          ←
        </Button>
      </div>
      <TransferSide
        heading={targetLabel}
        items={targetItems}
        selected={targetSelected}
        query={targetQuery}
        onQuery={setTargetQuery}
        onToggle={(id) => toggle(setTargetSelected, id)}
        onToggleAll={(ids) => toggleAll(setTargetSelected, ids)}
      />
    </div>
  );
}
