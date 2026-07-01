"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
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
import { useToast } from "@/components/ui/toast";
import { relativeTime } from "@/lib/relative-time";

import {
  useArchiveSolution,
  useDeleteSolution,
  useDuplicateSolution,
  useSetSolutionStatus,
  useSolutionsQuery,
  useUnarchiveSolution,
} from "../api/solutions";
import {
  STATUS_LABEL,
  statusTone,
  TYPE_LABEL,
  type Solution,
  type SolutionSort,
  type SolutionStatus,
  type SolutionType,
} from "../schemas/solution";
import { EditSolutionSlideOver } from "./edit-solution-slide-over";
import { RegisterSolutionDialog } from "./register-solution-dialog";

const SORT_OPTIONS: { value: SolutionSort; label: string }[] = [
  { value: "updated", label: "Sort by recently updated" },
  { value: "name", label: "Sort by name" },
  { value: "status", label: "Sort by status" },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "chat", label: "Chat" },
  { value: "embedded", label: "Embedded" },
];

const STATUS_ITEMS: { value: SolutionStatus; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "draft", label: "Draft" },
  { value: "maintenance", label: "Maintenance" },
  { value: "down", label: "Down" },
];

const SKELETON_ROWS = [0, 1, 2, 3, 4];

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Solutions table (FR-ADM-S-01) with inline status selector + row actions (FR-ADM-S-04). */
export function SolutionsDirectory() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SolutionSort>("updated");
  const [typeFilter, setTypeFilter] = useState<SolutionType | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const term = search.trim();
  const input = {
    search: term || undefined,
    sort,
    type: typeFilter === "all" ? undefined : typeFilter,
  };
  const { data: solutions, isPending, isError, error } = useSolutionsQuery(input);

  const editing = solutions?.find((s) => s.id === editingId) ?? null;

  function openEdit(s: Solution) {
    setEditingId(s.id);
  }
  function onCreated(id: string) {
    setEditingId(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">Solutions</h1>
          <p className="text-small text-[var(--ink2)]">
            Register and configure the chat and embedded solutions available to your groups.
          </p>
        </div>
        <Button onClick={() => setRegisterOpen(true)}>Register solution</Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="max-w-[320px]"
        />
        <Select
          items={TYPE_OPTIONS}
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as SolutionType | "all")}
          className="w-[160px]"
        />
        <Select
          items={SORT_OPTIONS}
          value={sort}
          onValueChange={(v) => setSort(v as SolutionSort)}
          className="w-[220px]"
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-small text-[var(--error)]">
          {(error as { message?: string })?.message || "Couldn't load solutions."}
        </p>
      ) : solutions.length === 0 ? (
        <EmptyState
          title={term || typeFilter !== "all" ? "No matches" : "No solutions yet"}
          description={
            term || typeFilter !== "all"
              ? "Try a different search or filter."
              : "Register your first chat or embedded solution to make it available to groups."
          }
          action={<Button onClick={() => setRegisterOpen(true)}>Register solution</Button>}
        />
      ) : (
        <SolutionsTable solutions={solutions} onEdit={openEdit} />
      )}

      <RegisterSolutionDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={onCreated}
      />
      <EditSolutionSlideOver
        solution={editing}
        open={editingId !== null}
        onOpenChange={(next) => {
          if (!next) setEditingId(null);
        }}
      />
    </div>
  );
}

function SolutionsTable({
  solutions,
  onEdit,
}: {
  solutions: Solution[];
  onEdit: (s: Solution) => void;
}) {
  return (
    <TableScroll>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Theme</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {solutions.map((s) => (
            <SolutionRow key={s.id} solution={s} onEdit={() => onEdit(s)} />
          ))}
        </TableBody>
      </Table>
    </TableScroll>
  );
}

function SolutionRow({ solution, onEdit }: { solution: Solution; onEdit: () => void }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const setStatus = useSetSolutionStatus();
  const duplicate = useDuplicateSolution();
  const archive = useArchiveSolution();
  const unarchive = useUnarchiveSolution();
  const remove = useDeleteSolution();

  const busy =
    setStatus.isPending ||
    duplicate.isPending ||
    archive.isPending ||
    unarchive.isPending ||
    remove.isPending;

  async function handleStatusChange(next: SolutionStatus) {
    if (next === solution.status) return;
    const goingDown = next === "down";
    const ok = goingDown
      ? await confirm({
          title: `Take “${solution.name}” down?`,
          description:
            "It immediately stops being openable for everyone it's granted to. They'll see a Down notice.",
          confirmLabel: "Mark Down",
          tone: "danger",
        })
      : true;
    if (!ok) return;
    try {
      await setStatus.mutateAsync({ id: solution.id, status: next });
      toast({ tone: "success", description: `Status set to ${STATUS_LABEL[next]}.` });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleArchive() {
    const ok = await confirm({
      title: `Archive “${solution.name}”?`,
      description: "It disappears from everyone's catalogue, favourites, and recents immediately.",
      confirmLabel: "Archive",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await archive.mutateAsync({ id: solution.id });
      toast({ tone: "success", description: "Solution archived." });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleUnarchive() {
    try {
      await unarchive.mutateAsync({ id: solution.id });
      toast({ tone: "success", description: "Solution restored." });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleDuplicate() {
    try {
      await duplicate.mutateAsync({ id: solution.id });
      toast({ tone: "success", description: "Duplicated as a draft." });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete “${solution.name}”?`,
      description:
        "Permanent. It's revoked from every group that had it, and removed from all favourites and recents.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: solution.id });
      toast({ tone: "success", description: "Solution deleted." });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  return (
    <TableRow>
      <TableCell>
        <button type="button" onClick={onEdit} className="flex items-center gap-3 text-left">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center border border-[var(--line)] font-mono text-mono-sm font-bold text-[var(--ink2)]"
          >
            {solution.monogram ?? "·"}
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-foreground hover:underline">{solution.name}</span>
            {solution.description ? (
              <span className="text-mono-xs text-[var(--ink3)] line-clamp-1 max-w-[360px]">
                {solution.description}
              </span>
            ) : null}
          </span>
        </button>
      </TableCell>
      <TableCell>
        <StatusBadge tone="neutral">{TYPE_LABEL[solution.type]}</StatusBadge>
      </TableCell>
      <TableCell>
        {/* Inline status selector (FR-ADM-S-01). */}
        <div className="flex items-center gap-2">
          <StatusBadge tone={statusTone(solution.status)} dot>
            {STATUS_LABEL[solution.status]}
          </StatusBadge>
          <Select
            items={STATUS_ITEMS}
            value={solution.status}
            onValueChange={(v) => void handleStatusChange(v as SolutionStatus)}
            disabled={busy}
            className="w-[150px]"
            aria-label={`Status for ${solution.name}`}
          />
        </div>
      </TableCell>
      <TableCell className="text-[var(--ink2)]">
        {solution.type === "chat" ? (
          (solution.themeName ?? <span className="text-mono-xs text-[var(--ink3)]">No theme</span>)
        ) : (
          <span className="text-mono-xs text-[var(--ink3)]">—</span>
        )}
      </TableCell>
      <TableCell className="text-mono-xs text-[var(--ink3)]">
        {relativeTime(solution.updatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
            Configure
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handleDuplicate()} disabled={busy}>
            Duplicate
          </Button>
          {solution.archived ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleUnarchive()}
              disabled={busy}
            >
              Restore
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => void handleArchive()} disabled={busy}>
              Archive
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={busy}
          >
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
