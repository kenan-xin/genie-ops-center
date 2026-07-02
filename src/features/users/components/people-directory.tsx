"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { relativeTime } from "@/lib/relative-time";
import { useTRPC } from "@/trpc/provider";

import {
  ROLE_LABEL,
  STATUS_LABEL,
  type Person,
  type PersonSort,
  type PersonStatus,
} from "../schemas/person";
import { EditPersonSlideOver } from "./edit-person-slide-over";
import { InvitePersonDialog } from "./invite-person-dialog";

const SORT_OPTIONS: { value: PersonSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
];

const STATUS_TONE = { active: "success", pending: "warn", disabled: "neutral" } as const;
const DOTTED_STATUS = new Set<PersonStatus>(["active", "pending"]);
const VISIBLE_GROUP_CHIPS = 2;
const SKELETON_ROWS = [0, 1, 2, 3, 4];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}

/** People directory (FR-ADM-P-01): search + sort, one slide-over per person for everything else. Proto 644-677. */
export function PeopleDirectory() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PersonSort>("name");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const term = search.trim();
  const input = term ? { search: term, sort } : { sort };
  const people = useQuery(trpc.users.list.queryOptions(input));

  const editingPerson = useMemo(
    () => people.data?.find((p) => p.id === editingId) ?? null,
    [people.data, editingId],
  );

  function openEdit(person: Person) {
    setEditingId(person.id);
    setEditOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-title font-extrabold tracking-[-0.01em]">People</h1>
        <p className="text-small text-[var(--ink2)]">
          Everyone with a workspace account. A person&rsquo;s access comes entirely from the groups
          they belong to.
        </p>
      </header>

      <div className="flex items-center gap-2 border border-[var(--brand)]/25 bg-[var(--brandtint)] px-3.5 py-2.5">
        <span className="font-mono text-mono-xs font-semibold whitespace-nowrap tracking-[0.08em] text-[var(--brandink)] uppercase">
          How access works
        </span>
        <span className="text-small text-[var(--ink2)]">
          Add a person to a group to grant solutions — there are no per-person permissions.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase">
          All people
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users…"
            className="max-w-[220px]"
          />
          <Select
            items={SORT_OPTIONS}
            value={sort}
            onValueChange={(value) => setSort(value as PersonSort)}
            className="w-[140px]"
          />
          <Button onClick={() => setInviteOpen(true)}>+ Add person</Button>
        </div>
      </div>

      {people.isPending ? (
        <div className="border border-[var(--line)]">
          <div className="flex items-center gap-4 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="ml-auto h-3 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
          {SKELETON_ROWS.map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[var(--line2)] px-4 py-3.5 last:border-b-0"
            >
              <Skeleton className="size-[30px] shrink-0" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-6 w-14" />
            </div>
          ))}
        </div>
      ) : people.isError ? (
        <p className="text-small text-[var(--error)]">
          {people.error.message || "Couldn't load people."}
        </p>
      ) : people.data.length === 0 ? (
        <EmptyState
          title={term ? "No people match your search" : "No people yet"}
          description={
            term
              ? "Try a different name, email or role."
              : "Add the first person to get them access."
          }
        />
      ) : (
        <TableScroll>
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.data.map((person) => {
                const extraGroups = person.groups.length - VISIBLE_GROUP_CHIPS;
                return (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div
                          aria-hidden
                          className="flex size-[30px] shrink-0 items-center justify-center bg-[var(--panel)] font-sans text-[10px] font-extrabold text-foreground"
                        >
                          {initials(person.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">
                            {person.name}
                          </div>
                          <div className="truncate text-mono-xs text-[var(--ink3)]">
                            {person.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{ROLE_LABEL[person.role]}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openEdit(person)}
                        title="View all groups"
                        className="flex flex-wrap items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {person.groups.length === 0 ? (
                          <StatusBadge tone="neutral">No groups</StatusBadge>
                        ) : (
                          <>
                            {person.groups.slice(0, VISIBLE_GROUP_CHIPS).map((g) => (
                              <StatusBadge key={g.id} tone="neutral">
                                {g.name}
                              </StatusBadge>
                            ))}
                            {extraGroups > 0 ? (
                              <StatusBadge tone="neutral">+{extraGroups} more</StatusBadge>
                            ) : null}
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-mono-xs text-[var(--ink3)]">
                      {person.lastActiveAt ? relativeTime(person.lastActiveAt) : "Never"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={STATUS_TONE[person.status]}
                        dot={DOTTED_STATUS.has(person.status)}
                      >
                        {STATUS_LABEL[person.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" onClick={() => openEdit(person)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableScroll>
      )}

      <InvitePersonDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditPersonSlideOver person={editingPerson} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
