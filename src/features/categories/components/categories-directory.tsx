"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useSolutionsQuery } from "@/features/solutions/api/solutions";
import type { Solution } from "@/features/solutions/schemas/solution";

import {
  useAssignCategory,
  useAssignments,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
  useReorderCategories,
} from "../api/categories";
import type { CategorySummary } from "../schemas/category";

/**
 * Admin Categories directory. Structural model: groups-directory (header →
 * brand callout → create control → table with skeleton/error/empty states);
 * the inline per-row editing follows solutions-directory's row pattern (inline
 * status Select, icon actions) because groups edits through a dialog, not
 * inline. No drag-and-drop: up/down buttons write the whole `position` order.
 */

const SKELETON_ROWS = [0, 1, 2, 3, 4];

// Select values are strings; `null` ("no category") needs a sentinel item.
const NONE_VALUE = "none";

// Required copy beside the delete-confirm control (design spec: Admin console).
const DELETE_CONFIRM_COPY =
  "Solutions in this category move to the standalone list. None are removed.";

// Prototype-style fixed columns: 224px action lane (4 icon buttons + gaps),
// the rest split 26 : 9 between name and count (groups-directory ratio).
const CATEGORY_COLUMN_WIDTHS = {
  name: "calc((100% - 224px) * 26 / 35)",
  solutions: "calc((100% - 224px) * 9 / 35)",
  actions: "224px",
} as const;

const ASSIGN_COLUMN_WIDTHS = {
  solution: "calc(100% - 280px)",
  category: "280px",
} as const;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function CategoriesDirectory() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  // One row edits or confirms at a time — the admin list is short.
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const categoriesQuery = useCategories();
  const assignmentsQuery = useAssignments();
  const solutionsQuery = useSolutionsQuery({ sort: "name", archived: false });
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const remove = useDeleteCategory();
  const reorder = useReorderCategories();
  const assign = useAssignCategory();

  const categories = categoriesQuery.data ?? [];

  // Solution → category, straight from the admin `assignments` read. Unlike the
  // customer sidebar read it includes drafts, so a draft's filing survives a
  // reload and counts as filed below.
  const assignedBySolution = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignmentsQuery.data ?? []) map.set(a.solutionId, a.categoryId);
    return map;
  }, [assignmentsQuery.data]);

  const solutions = solutionsQuery.data ?? [];
  const categoryOf = (solutionId: string): string | null =>
    assignedBySolution.get(solutionId) ?? null;
  const unfiledCount = solutions.filter((s) => categoryOf(s.id) === null).length;

  const assignItems = useMemo(() => {
    const list = categoriesQuery.data ?? [];
    return [
      { value: NONE_VALUE, label: "None" },
      ...list.map((c) => ({ value: c.id, label: c.name })),
    ];
  }, [categoriesQuery.data]);

  const trimmedNewName = newName.trim();
  const canCreate = trimmedNewName.length > 0 && !create.isPending;

  async function handleCreate() {
    if (!canCreate) return;
    try {
      // create resolves { id } only — echo the submitted name, not the payload.
      await create.mutateAsync({ name: trimmedNewName });
      toast({ tone: "success", description: `Created “${trimmedNewName}”.` });
      setNewName("");
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function commitRename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    const original = categories.find((c) => c.id === renaming.id)?.name;
    if (!name || name === original) {
      setRenaming(null);
      return;
    }
    try {
      await rename.mutateAsync({ id: renaming.id, name });
      setRenaming(null);
      toast({ tone: "success", description: `Renamed to “${name}”.` });
    } catch (e) {
      // Keep the edit open so the typed text isn't lost.
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleMove(index: number, delta: -1 | 1) {
    const orderedIds = categories.map((c) => c.id);
    const j = index + delta;
    if (j < 0 || j >= orderedIds.length) return;
    [orderedIds[index], orderedIds[j]] = [orderedIds[j], orderedIds[index]];
    try {
      // Whole-set write: every id, in the new order.
      await reorder.mutateAsync({ orderedIds });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleDelete(category: CategorySummary) {
    try {
      await remove.mutateAsync({ id: category.id });
      setConfirmingId(null);
      toast({ tone: "success", description: `Deleted “${category.name}”.` });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  async function handleAssign(solution: Solution, value: string) {
    const categoryId = value === NONE_VALUE ? null : value;
    const label = categoryId
      ? (categories.find((c) => c.id === categoryId)?.name ?? "its category")
      : null;
    try {
      await assign.mutateAsync({ solutionId: solution.id, categoryId });
      toast({
        tone: "success",
        description: label
          ? `“${solution.name}” filed under “${label}”.`
          : `“${solution.name}” now stands alone.`,
      });
    } catch (e) {
      toast({ tone: "error", description: errMsg(e) });
    }
  }

  const listPending = categoriesQuery.isPending || assignmentsQuery.isPending;
  // Both tables depend on these two reads. If either fails, `assignedBySolution`
  // and `assignItems` fall back to empty, so a filed solution renders as "None"
  // and the only choice on offer is "None" — an admin editing from that view
  // would overwrite real assignments. Neither table may render without them.
  const listError = categoriesQuery.isError || assignmentsQuery.isError;
  const listErrorMessage =
    ((categoriesQuery.error ?? assignmentsQuery.error) as { message: string } | null)?.message ||
    "Couldn't load categories.";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-title font-extrabold tracking-[-0.02em]">Categories</h1>
        <p className="text-small text-[var(--ink2)]">
          A category groups solutions in the customer sidebar. It changes what people see — never
          what they can open.
        </p>
      </header>

      <div className="flex flex-col gap-1 border border-[var(--brand)]/25 bg-[var(--brandtint)] px-3.5 py-2.5">
        <span className="shrink-0 font-mono text-mono-xs font-semibold tracking-[0.08em] text-[var(--brandink)] uppercase">
          How categories work
        </span>
        <span className="text-small text-[var(--brandink)]">
          Categories organize the sidebar only. Access is granted to groups in{" "}
          <span className="font-semibold">Access</span> — a category never widens what a person can
          open.
        </span>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name…"
          aria-label="New category name"
          className="w-full sm:max-w-[280px]"
        />
        <Button type="submit" variant="dark" className="px-[14px]" disabled={!canCreate}>
          {create.isPending ? "Adding…" : "Add category"}
        </Button>
      </form>

      {listPending ? (
        <div className="flex flex-col gap-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : listError ? (
        <p className="text-small text-[var(--error)]">{listErrorMessage}</p>
      ) : categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Name a category above, then file solutions into it below — they'll group up in the customer sidebar."
        />
      ) : (
        <TableScroll>
          <Table className="min-w-[560px] table-fixed">
            <colgroup>
              <col style={{ width: CATEGORY_COLUMN_WIDTHS.name }} />
              <col style={{ width: CATEGORY_COLUMN_WIDTHS.solutions }} />
              <col style={{ width: CATEGORY_COLUMN_WIDTHS.actions }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Solutions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category, index) =>
                confirmingId === category.id ? (
                  <TableRow key={category.id}>
                    <TableCell colSpan={3}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => void handleDelete(category)}
                          disabled={remove.isPending}
                        >
                          {remove.isPending ? "Deleting…" : `Delete “${category.name}”`}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setConfirmingId(null)}
                          disabled={remove.isPending}
                        >
                          Cancel
                        </Button>
                        <span className="text-small text-[var(--ink2)]">{DELETE_CONFIRM_COPY}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={category.id}>
                    <TableCell>
                      {renaming?.id === category.id ? (
                        <RenameInput
                          value={renaming.name}
                          ariaLabel={`Rename ${category.name}`}
                          onChange={(name) => setRenaming({ id: category.id, name })}
                          onCommit={() => void commitRename()}
                          onCancel={() => setRenaming(null)}
                          disabled={rename.isPending}
                        />
                      ) : (
                        <span className="truncate text-body font-bold text-[var(--ink)]">
                          {category.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-mono-md font-semibold text-[var(--ink2)]">
                        {category.solutionCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Rename ${category.name}`}
                          aria-label={`Rename ${category.name}`}
                          onClick={() => setRenaming({ id: category.id, name: category.name })}
                          disabled={renaming !== null}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Move ${category.name} up`}
                          aria-label={`Move ${category.name} up`}
                          onClick={() => void handleMove(index, -1)}
                          disabled={index === 0 || reorder.isPending || renaming !== null}
                        >
                          <ChevronUpIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Move ${category.name} down`}
                          aria-label={`Move ${category.name} down`}
                          onClick={() => void handleMove(index, 1)}
                          disabled={
                            index === categories.length - 1 ||
                            reorder.isPending ||
                            renaming !== null
                          }
                        >
                          <ChevronDownIcon />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          title={`Delete ${category.name}`}
                          aria-label={`Delete ${category.name}`}
                          onClick={() => setConfirmingId(category.id)}
                          disabled={renaming !== null}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </TableScroll>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink2)] uppercase">
            Assign solutions
          </h2>
          <span
            className={cn(
              "font-mono text-mono-xs font-semibold tracking-[0.08em] uppercase",
              unfiledCount > 0 ? "text-[var(--warn)]" : "text-[var(--ink3)]",
            )}
          >
            {unfiledCount} uncategorized
          </span>
        </div>
        <p className="text-small text-[var(--ink2)]">
          Pick the category each solution sits under. Solutions set to{" "}
          <span className="font-semibold">None</span> render as standalone rows, below every
          category. Draft solutions join the sidebar once they&rsquo;re ready; archived ones never
          do.
        </p>

        {solutionsQuery.isPending || listPending ? (
          <div className="flex flex-col gap-2">
            {SKELETON_ROWS.map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : solutionsQuery.isError ? (
          <p className="text-small text-[var(--error)]">
            {(solutionsQuery.error as { message: string }).message || "Couldn't load solutions."}
          </p>
        ) : listError ? (
          <p className="text-small text-[var(--error)]">{listErrorMessage}</p>
        ) : solutions.length === 0 ? (
          <p className="text-small text-[var(--ink3)]">
            No solutions yet — register one in Solutions, then file it here.
          </p>
        ) : (
          <TableScroll>
            <Table className="min-w-[560px] table-fixed">
              <colgroup>
                <col style={{ width: ASSIGN_COLUMN_WIDTHS.solution }} />
                <col style={{ width: ASSIGN_COLUMN_WIDTHS.category }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Solution</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solutions.map((s) => {
                  const busy = assign.isPending && assign.variables?.solutionId === s.id;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-body font-semibold text-foreground">
                            {s.name}
                          </span>
                          {s.status === "draft" ? (
                            <span className="shrink-0 font-mono text-mono-xs font-semibold tracking-[0.06em] text-[var(--ink3)] uppercase">
                              Draft
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          items={assignItems}
                          value={categoryOf(s.id) ?? NONE_VALUE}
                          onValueChange={(v) => void handleAssign(s, v)}
                          disabled={busy}
                          aria-label={`Category for ${s.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </section>
    </div>
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

/**
 * Inline rename field. Focuses (and selects) on mount via a ref effect — not
 * `autoFocus`, which oxlint's jsx-a11y rule rejects. The value stays controlled
 * by the parent's `renaming` state so a failed commit keeps the typed text.
 */
function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  ariaLabel: string;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.select();
  }, []);
  return (
    <Input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      // Guard: in browsers that fire focusout when a focused element becomes
      // disabled, the pending flip would cancel the edit mid-submit.
      onBlur={() => {
        if (!disabled) onCancel();
      }}
      aria-label={ariaLabel}
      disabled={disabled}
    />
  );
}

function PencilIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
    </svg>
  );
}
