"use client";

import Link from "next/link";
import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";

import { useOverviewByPerson, useOverviewBySolution } from "../api/groups";

type View = "solution" | "person";

/**
 * Access Overview explorer (FR-ADM-O-01) — pick one solution or one person
 * and see a focused answer, instead of an exhaustive "show everything" list.
 * Reads the same membership ∩ grant union the access predicates read (single
 * source of truth), via `groups.overviewBySolution` / `overviewByPerson`.
 */
export function AccessOverview() {
  const [view, setView] = useState<View>("solution");

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        options={[
          { value: "solution", label: "Who can open a solution?" },
          { value: "person", label: "What can a person open?" },
        ]}
        value={view}
        onValueChange={(v) => setView(v)}
      />

      {view === "solution" ? <BySolution /> : <ByPerson />}
    </div>
  );
}

const SOLUTION_TYPE_LABEL: Record<"chat" | "native" | "embedded", string> = {
  chat: "CHAT",
  native: "NATIVE",
  embedded: "EMBED",
};

function ExplorerColumn({
  heading,
  count,
  suffix,
  children,
}: {
  heading: string;
  count: number;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 font-mono text-mono-xs font-semibold tracking-[0.08em] text-[var(--ink2)] uppercase">
        {heading} · {count}
        {suffix ? <span className="ml-1 font-medium text-[var(--ink3)]">{suffix}</span> : null}
      </div>
      {children}
    </div>
  );
}

function BySolution() {
  const { data, isPending, isError, error } = useOverviewBySolution();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
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
    return (
      <EmptyState
        title="No solutions yet"
        description="Register a solution under Solutions, then grant it to a group."
      />
    );
  }

  const selected = data.find((r) => r.solution.id === selectedId) ?? data[0]!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase">
          Solution
        </span>
        <Select
          items={data.map((r) => ({ value: r.solution.id, label: r.solution.name }))}
          value={selected.solution.id}
          onValueChange={setSelectedId}
          className="max-w-[320px]"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="font-sans text-cardhead font-extrabold text-foreground">
          Reaches{" "}
          <span className="text-[var(--brandink)]">
            {selected.people.length} {selected.people.length === 1 ? "person" : "people"}
          </span>{" "}
          via <span className="text-[var(--brandink)]">{selected.groups.length} groups</span>
        </p>
        <span className="bg-[var(--brandtint)] px-[10px] py-[5px] font-mono text-mono-sm font-semibold uppercase text-[var(--brandink)]">
          {SOLUTION_TYPE_LABEL[selected.solution.type]}
        </span>
      </div>

      {selected.groups.length === 0 ? (
        <EmptyState
          title="No group grants this solution yet"
          description="Open a group and switch it on in Access."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ExplorerColumn heading="Granted via" count={selected.groups.length}>
            <ul>
              {selected.groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--line2)] px-4 py-3 last:border-0"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-small font-semibold text-foreground">{g.name}</span>{" "}
                    <span className="font-mono text-mono-xs text-[var(--ink3)]">
                      · {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    </span>
                  </span>
                  <Link
                    href={`/admin/groups/${g.id}`}
                    className="shrink-0 text-mono-xs font-semibold text-[var(--brandink)] hover:underline"
                  >
                    Open group →
                  </Link>
                </li>
              ))}
            </ul>
          </ExplorerColumn>
          <ExplorerColumn heading="People reached" count={selected.people.length}>
            {selected.people.length === 0 ? (
              <p className="px-4 py-3 text-small text-[var(--ink3)]">No one reaches it yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 px-4 py-3.5">
                {selected.people.map((p) => (
                  <Chip key={p.id} truncate className="max-w-[180px] px-[10px] py-1 font-semibold">
                    {p.name}
                  </Chip>
                ))}
              </div>
            )}
          </ExplorerColumn>
        </div>
      )}
    </div>
  );
}

function ByPerson() {
  const { data, isPending, isError, error } = useOverviewByPerson();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
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

  const selected = data.find((r) => r.person.id === selectedId) ?? data[0]!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase">
          Person
        </span>
        <Select
          items={data.map((r) => ({
            value: r.person.id,
            label: r.person.name,
          }))}
          value={selected.person.id}
          onValueChange={setSelectedId}
          className="max-w-[320px]"
        />
        <span className="text-mono-xs text-[var(--ink3)]">{selected.person.email}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ExplorerColumn heading="Member of" count={selected.groups.length}>
          {selected.groups.length === 0 ? (
            <p className="px-4 py-3 text-small text-[var(--ink3)]">
              Not in any group, so no access. Open a group to add them.
            </p>
          ) : (
            <ul>
              {selected.groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--line2)] px-4 py-3 last:border-0"
                >
                  <span className="text-small font-semibold text-foreground">{g.name}</span>
                  <Link
                    href={`/admin/groups/${g.id}`}
                    className="shrink-0 text-mono-xs font-semibold text-[var(--brandink)] hover:underline"
                  >
                    Edit in group →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ExplorerColumn>
        <ExplorerColumn heading="Can open" count={selected.solutions.length} suffix="(derived)">
          {selected.solutions.length === 0 ? (
            <p className="px-4 py-3 text-small text-[var(--ink3)]">
              Granted solutions reach no one here.
            </p>
          ) : (
            <ul>
              {selected.solutions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--line2)] px-4 py-3 last:border-0"
                >
                  <span className="text-small text-foreground">{s.name}</span>
                  <span className="shrink-0 font-mono text-mono-xs text-[var(--ink3)]">
                    via {s.grantedBy.map((g) => g.name).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ExplorerColumn>
      </div>
    </div>
  );
}
