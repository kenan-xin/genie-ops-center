"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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

import { ROLE_LABEL, STATUS_LABEL, type Person, type PersonSort } from "../schemas/person";
import { EditPersonSlideOver } from "./edit-person-slide-over";
import { InvitePersonDialog } from "./invite-person-dialog";

const SORT_OPTIONS: { value: PersonSort; label: string }[] = [
  { value: "name", label: "Sort by name" },
  { value: "role", label: "Sort by role" },
  { value: "status", label: "Sort by status" },
];

const STATUS_TONE = { active: "success", pending: "warn", disabled: "error" } as const;
const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** People directory (FR-ADM-P-01): search + sort, one slide-over per person for everything else. */
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
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">People</h1>
          <p className="text-small text-[var(--ink2)]">
            Everyone with access to this workspace, and their group membership.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite person</Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, or role…"
          className="max-w-[320px]"
        />
        <Select
          items={SORT_OPTIONS}
          value={sort}
          onValueChange={(value) => setSort(value as PersonSort)}
          className="w-[180px]"
        />
      </div>

      {people.isPending ? (
        <div className="flex flex-col gap-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : people.isError ? (
        <p className="text-small text-[var(--error)]">
          {people.error.message || "Couldn't load people."}
        </p>
      ) : people.data.length === 0 ? (
        <EmptyState
          title={term ? "No matches" : "No people yet"}
          description={
            term ? "Try a different search term." : "Invite the first person to get them access."
          }
        />
      ) : (
        <TableScroll>
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.data.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{person.name}</span>
                      <span className="text-mono-xs text-[var(--ink3)]">{person.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{ROLE_LABEL[person.role]}</TableCell>
                  <TableCell>
                    <StatusBadge tone={STATUS_TONE[person.status]} dot>
                      {STATUS_LABEL[person.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {person.groups.length === 0 ? (
                      <span className="text-mono-xs text-[var(--ink3)]">No groups</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {person.groups.map((g) => (
                          <Link key={g.id} href={`/admin/groups/${g.id}`}>
                            <StatusBadge tone="neutral" className="cursor-pointer hover:opacity-80">
                              {g.name}
                            </StatusBadge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-mono-xs text-[var(--ink3)]">
                    {person.lastActiveAt ? relativeTime(person.lastActiveAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(person)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      )}

      <InvitePersonDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditPersonSlideOver person={editingPerson} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
