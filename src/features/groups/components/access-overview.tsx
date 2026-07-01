"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { useOverviewByPerson, useOverviewBySolution } from "../api/groups";

type View = "solution" | "person";

/**
 * Access Overview explorer (FR-ADM-O-01). Reads the membership ∩ grant union
 * — the same source of truth as the access predicates — from two angles:
 * _By solution_ (groups that grant it → people it reaches) and _By person_
 * (their groups → resulting solutions, annotated by granting group). Each
 * group name links into the inspector.
 */
export function AccessOverview() {
  const [view, setView] = useState<View>("solution");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">
          Access overview
        </h1>
        <p className="text-small text-[var(--ink2)]">
          Who can reach what — derived live from group membership and grants. Archived solutions are
          excluded.
        </p>
      </header>

      <SegmentedControl
        options={[
          { value: "solution", label: "By solution" },
          { value: "person", label: "By person" },
        ]}
        value={view}
        onValueChange={(v) => setView(v)}
      />

      {view === "solution" ? <BySolution /> : <ByPerson />}
    </div>
  );
}

const STATUS_TONE = {
  ready: "success",
  maintenance: "warn",
  down: "error",
  draft: "neutral",
} as const;

function BySolution() {
  const { data, isPending, isError, error } = useOverviewBySolution();
  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-small text-[var(--error)]">{(error as { message: string }).message}</p>
    );
  }
  const granted = data.filter((r) => r.groups.length > 0);
  if (granted.length === 0) {
    return (
      <EmptyState
        title="No grants yet"
        description="Grant a group access to a solution and it'll show up here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {granted.map((r) => (
        <div
          key={r.solution.id}
          className="flex flex-col gap-2 border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{r.solution.name}</span>
              {r.solution.archived ? (
                <StatusBadge tone="neutral">Archived</StatusBadge>
              ) : (
                <StatusBadge tone={STATUS_TONE[r.solution.status]}>{r.solution.status}</StatusBadge>
              )}
            </div>
            <span className="font-mono text-mono-xs text-[var(--ink3)]">
              {r.people.length} {r.people.length === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {r.groups.map((g) => (
              <Link key={g.id} href={`/admin/groups/${g.id}`}>
                <StatusBadge tone="neutral" className="cursor-pointer hover:opacity-80">
                  {g.name}
                </StatusBadge>
              </Link>
            ))}
          </div>
          <p className="text-small text-[var(--ink2)]">
            {r.people.map((p) => p.name).join(", ") || "No one reaches this solution."}
          </p>
        </div>
      ))}
    </div>
  );
}

function ByPerson() {
  const { data, isPending, isError, error } = useOverviewByPerson();
  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-small text-[var(--error)]">{(error as { message: string }).message}</p>
    );
  }
  if (data.length === 0) {
    return <EmptyState title="No people yet" description="Add people via the People directory." />;
  }
  return (
    <div className="flex flex-col gap-3">
      {data.map((r) => (
        <div
          key={r.person.id}
          className="flex flex-col gap-2 border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">{r.person.name}</span>
              <span className="text-mono-xs text-[var(--ink3)]">{r.person.email}</span>
            </div>
            <span className="font-mono text-mono-xs text-[var(--ink3)]">
              {r.solutions.length} {r.solutions.length === 1 ? "solution" : "solutions"}
            </span>
          </div>
          {r.groups.length === 0 ? (
            <p className="text-small text-[var(--ink3)]">In no groups — no access.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-mono-xs text-[var(--ink3)]">Groups:</span>
                {r.groups.map((g) => (
                  <Link key={g.id} href={`/admin/groups/${g.id}`}>
                    <StatusBadge tone="neutral" className="cursor-pointer hover:opacity-80">
                      {g.name}
                    </StatusBadge>
                  </Link>
                ))}
              </div>
              {r.solutions.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {r.solutions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 text-small">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="text-mono-xs text-[var(--ink3)]">
                        via {s.grantedBy.map((g) => g.name).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-[var(--ink3)]">
                  Granted solutions reach no one here.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
