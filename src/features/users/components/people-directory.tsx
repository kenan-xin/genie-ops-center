"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
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

// Prototype grid-template-columns `1.7fr .8fr 1.7fr .8fr .8fr .6fr`
// (.dc.html:657) converted to percentages, keyed by column id for the
// <colgroup> (avoids an array-index key since widths repeat).
const COLUMN_WIDTHS: Record<string, string> = {
  user: "26.6%",
  role: "12.5%",
  groups: "26.6%",
  lastActive: "12.5%",
  status: "12.5%",
  actions: "9.4%",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}

const columnHelper = createColumnHelper<Person>();

/**
 * Column defs live in a module-level factory (not inline in the component
 * body) so oxlint's `no-unstable-nested-components` doesn't mistake the
 * TanStack `cell` renderers — plain functions returning JSX, called via
 * `flexRender`, not components mounted by React directly — for components
 * defined during render.
 */
function buildColumns(openEdit: (person: Person) => void) {
  return [
    // Combined name+email accessor so the global filter matches either
    // (AP-02); the cell renderer builds the avatar/name/email layout from
    // `row.original` directly.
    columnHelper.accessor((row) => `${row.name} ${row.email}`, {
      id: "user",
      header: "User",
      cell: (info) => {
        const person = info.row.original;
        return (
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden
              className="flex size-[30px] shrink-0 items-center justify-center bg-[var(--panel)] text-[10px] font-heading font-extrabold text-[var(--ink)]"
            >
              {initials(person.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-body font-semibold text-foreground">{person.name}</div>
              <div className="truncate font-mono text-mono-md text-[var(--ink3)]">
                {person.email}
              </div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor((row) => ROLE_LABEL[row.role], {
      id: "role",
      header: "Role",
      cell: (info) => <span className="text-small text-[var(--ink2)]">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "groups",
      header: "Groups",
      enableGlobalFilter: false,
      cell: (info) => {
        const person = info.row.original;
        const extraGroups = person.groups.length - VISIBLE_GROUP_CHIPS;
        return (
          <button
            type="button"
            onClick={() => openEdit(person)}
            title="View all groups"
            className="flex flex-wrap items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {person.groups.length === 0 ? (
              <span className="font-mono text-mono-md text-[var(--ink3)]">No groups</span>
            ) : (
              <>
                {person.groups.slice(0, VISIBLE_GROUP_CHIPS).map((g) => (
                  <Chip key={g.id} truncate className="max-w-[120px] font-semibold">
                    {g.name}
                  </Chip>
                ))}
                {extraGroups > 0 ? (
                  <span className="inline-flex items-center rounded-[2px] border border-[var(--line2)] bg-[var(--panel)] px-[6px] py-[2px] font-mono text-mono-md font-semibold text-[var(--ink2)]">
                    +{extraGroups} more
                  </span>
                ) : null}
              </>
            )}
          </button>
        );
      },
    }),
    columnHelper.accessor((row) => row.lastActiveAt, {
      id: "lastActive",
      header: "Last active",
      enableGlobalFilter: false,
      cell: (info) => {
        const lastActiveAt = info.getValue();
        return (
          <span className="font-mono text-mono-md text-[var(--ink3)]">
            {lastActiveAt ? relativeTime(lastActiveAt) : "Never"}
          </span>
        );
      },
    }),
    columnHelper.accessor((row) => row.status, {
      id: "status",
      header: "Status",
      enableGlobalFilter: false,
      cell: (info) => {
        const status = info.getValue();
        return (
          <StatusBadge tone={STATUS_TONE[status]} dot={DOTTED_STATUS.has(status)}>
            {STATUS_LABEL[status]}
          </StatusBadge>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      enableGlobalFilter: false,
      cell: (info) => (
        <Button
          variant="link"
          size="sm"
          className="text-small font-semibold text-[var(--brandink)]"
          onClick={() => openEdit(info.row.original)}
        >
          Manage
        </Button>
      ),
    }),
  ];
}

/** People directory (FR-ADM-P-01): search + sort, one slide-over per person for everything else. Proto 644-677. */
export function PeopleDirectory() {
  const trpc = useTRPC();
  const [globalFilter, setGlobalFilter] = useState("");
  const [sort, setSort] = useState<PersonSort>("name");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Server sorts (whole-roster JS sort, see users/server/router.ts); search is
  // a client-side global filter (AP-02) — the roster is small enough that
  // per-keystroke round trips buy nothing over an instant client-side filter.
  const people = useQuery(trpc.users.list.queryOptions({ sort }));

  const editingPerson = useMemo(
    () => people.data?.find((p) => p.id === editingId) ?? null,
    [people.data, editingId],
  );

  const openEdit = useCallback((person: Person) => {
    setEditingId(person.id);
    setEditOpen(true);
  }, []);

  const columns = useMemo(() => buildColumns(openEdit), [openEdit]);

  const table = useReactTable({
    data: people.data ?? [],
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-title font-extrabold tracking-[-0.01em]">People</h1>
        <p className="text-small text-[var(--ink2)]">
          Everyone with a workspace account. A person&rsquo;s access comes entirely from the groups
          they belong to.
        </p>
      </header>

      <div className="flex flex-col gap-1 border border-[#d7e3f6] bg-[var(--brandtint)] px-[13px] py-[9px]">
        <span className="font-mono text-mono-xs font-semibold whitespace-nowrap tracking-[0.08em] text-[var(--brandink)] uppercase">
          How access works
        </span>
        <span className="text-small text-[#2a4d80]">
          Add a person to a group to grant solutions — there are no per-person permissions.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase">
          All people
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <AdminSearchInput
            value={globalFilter}
            onChange={setGlobalFilter}
            placeholder="Search users…"
            aria-label="Search users"
          />
          <Select
            items={SORT_OPTIONS}
            value={sort}
            onValueChange={(value) => setSort(value as PersonSort)}
            className="w-[140px]"
          />
          <Button
            variant="dark"
            size="sm"
            className="px-[14px]"
            onClick={() => setInviteOpen(true)}
          >
            + Add person
          </Button>
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
        <EmptyState title="No people yet" description="Add the first person to get them access." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No people match your search"
          description="Try a different name, email or role."
        />
      ) : (
        <TableScroll>
          <Table className="min-w-[720px] table-fixed">
            <colgroup>
              {table.getAllLeafColumns().map((column) => (
                <col key={column.id} style={{ width: COLUMN_WIDTHS[column.id] }} />
              ))}
            </colgroup>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={header.column.id === "actions" ? "text-right" : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === "actions" ? "text-right" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
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
