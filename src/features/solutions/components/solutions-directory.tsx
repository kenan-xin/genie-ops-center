"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented";
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
import { cn } from "@/lib/utils";

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

const TYPE_FILTER_OPTIONS: { value: SolutionType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "embedded", label: "Embedded" },
];

const STATUS_ITEMS: { value: SolutionStatus; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "draft", label: "Draft" },
  { value: "maintenance", label: "Maintenance" },
  { value: "down", label: "Down" },
];

const TYPE_LABEL_UPPER: Record<SolutionType, string> = { chat: "CHAT", embedded: "EMBED" };

const STATUS_SELECT_CLASS: Record<SolutionStatus, string> = {
  ready: "border-[var(--success)] bg-[var(--successtint)] text-[var(--success)]",
  draft: "border-[var(--ink3)] bg-[var(--panel)] text-[var(--ink3)]",
  maintenance: "border-[var(--warn)] bg-[var(--warntint)] text-[var(--warn)]",
  down: "border-[var(--error)] bg-[var(--errortint)] text-[var(--error)]",
};

const SKELETON_ROWS = [0, 1, 2, 3, 4];

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Solutions directory (FR-ADM-S-01), proto 684-700: compact 4-col table + icon-button actions. */
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
          <h1 className="font-sans text-title font-extrabold tracking-[-0.02em]">Solutions</h1>
        </div>
        <Button variant="dark" className="px-[14px]" onClick={() => setRegisterOpen(true)}>
          + Add
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search solutions…"
          className="w-full sm:max-w-[280px]"
        />
        <SegmentedControl
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v)}
          className="w-full sm:w-auto"
        />
        <Select
          items={SORT_OPTIONS}
          value={sort}
          onValueChange={(v) => setSort(v as SolutionSort)}
          className="w-full sm:w-[240px] lg:ml-auto"
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
          title={
            term || typeFilter !== "all" ? "No solutions match your filters" : "No solutions yet"
          }
          description={
            term || typeFilter !== "all"
              ? "Try a different search term or type."
              : "Register your first chat or embedded solution to make it available to groups."
          }
          action={<Button onClick={() => setRegisterOpen(true)}>+ Add</Button>}
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
      <Table className="min-w-[880px] table-fixed">
        <colgroup>
          <col style={{ width: "33.333%" }} />
          <col style={{ width: "11.111%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "35.556%" }} />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Solution</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
        <button type="button" onClick={onEdit} className="flex items-center gap-[11px] text-left">
          <span
            aria-hidden
            className="flex size-[30px] shrink-0 items-center justify-center bg-[var(--panel)] text-[10px] font-heading font-extrabold text-[var(--ink)]"
          >
            {solution.monogram ?? "·"}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-foreground hover:underline">
                {solution.name}
              </span>
              {solution.archived ? (
                <StatusBadge tone="neutral" className="shrink-0">
                  Archived
                </StatusBadge>
              ) : null}
            </span>
            {solution.description ? (
              <span className="text-mono-xs text-[var(--ink3)] line-clamp-1 max-w-[360px]">
                {solution.description}
              </span>
            ) : null}
          </span>
        </button>
      </TableCell>
      <TableCell>
        <span className="font-mono text-mono-md font-semibold uppercase text-[var(--ink2)]">
          {TYPE_LABEL_UPPER[solution.type]}
        </span>
      </TableCell>
      <TableCell>
        {solution.archived ? (
          <span className="font-mono text-mono-md font-medium text-[var(--ink3)]">
            Hidden from hub
          </span>
        ) : (
          <Select
            items={STATUS_ITEMS}
            value={solution.status}
            onValueChange={(v) => void handleStatusChange(v as SolutionStatus)}
            disabled={busy}
            aria-label={`Status for ${solution.name}`}
            className={cn(
              "h-auto w-auto gap-1.5 border px-2 py-1 font-mono text-mono-sm font-semibold tracking-[0.06em]",
              STATUS_SELECT_CLASS[solution.status],
            )}
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <IconButton label="Configure" tone="brand" onClick={onEdit} disabled={busy}>
            <GearIcon />
          </IconButton>
          <IconButton label="Duplicate" onClick={() => void handleDuplicate()} disabled={busy}>
            <DuplicateIcon />
          </IconButton>
          {solution.archived ? (
            <IconButton label="Restore" onClick={() => void handleUnarchive()} disabled={busy}>
              <RestoreIcon />
            </IconButton>
          ) : (
            <IconButton label="Archive" onClick={() => void handleArchive()} disabled={busy}>
              <ArchiveIcon />
            </IconButton>
          )}
          <IconButton
            label="Delete"
            tone="error"
            onClick={() => void handleDelete()}
            disabled={busy}
          >
            <TrashIcon />
          </IconButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "brand" | "error";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center border border-[var(--line)] bg-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        tone === "brand" && "text-[var(--brandink)] hover:bg-[var(--brandtint)]",
        tone === "error" && "text-[var(--error)] hover:bg-[var(--errortint)]",
        tone === "default" && "text-[var(--ink2)] hover:bg-[var(--panel)]",
      )}
    >
      {children}
    </button>
  );
}

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
} as const;

function GearIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <rect x="9" y="9" width="12" height="12" rx="0" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <rect x="3" y="4" width="18" height="4" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 13h4" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
