"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { useCreateGroup, useGroupsQuery } from "../api/groups";
import { createGroupSchema, type CreateGroupValues } from "../schemas/group";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** Groups directory (FR-ADM-G-01/02): search, create, select → inspector. */
export function GroupsDirectory() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: groups, isPending, isError, error } = useGroupsQuery(search);

  const term = search.trim();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">Groups</h1>
          <p className="text-small text-[var(--ink2)]">
            The single access mechanism — a person reaches a solution through a group that grants
            it.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New group</Button>
      </header>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search groups…"
        className="max-w-[320px]"
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-small text-[var(--error)]">
          {(error as { message: string }).message || "Couldn't load groups."}
        </p>
      ) : groups.length === 0 ? (
        <EmptyState
          title={term ? "No matches" : "No groups yet"}
          description={
            term
              ? "Try a different search term."
              : "Create a group, add people, and grant it solutions to manage access."
          }
          action={
            !term ? <Button onClick={() => setCreateOpen(true)}>New group</Button> : undefined
          }
        />
      ) : (
        <TableScroll>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Solutions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link href={`/admin/groups/${g.id}`} className="flex flex-col hover:underline">
                      <span className="font-semibold text-foreground">{g.name}</span>
                      {g.description ? (
                        <span className="text-mono-xs text-[var(--ink3)]">{g.description}</span>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[var(--ink2)]">{g.memberCount}</TableCell>
                  <TableCell className="text-[var(--ink2)]">{g.solutionCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const createGroup = useCreateGroup();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createGroup.mutateAsync(values);
      toast({ tone: "success", description: `Created "${created.name}".` });
      reset();
      onOpenChange(false);
      router.push(`/admin/groups/${created.id}`);
    } catch (e) {
      setError("root", { message: (e as { message: string }).message });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>
              Add people and grant solutions from the group inspector after creating it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5">
            {errors.root ? <FieldError message={errors.root.message} /> : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input id="group-name" {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-description">Description (optional)</Label>
              <Input id="group-description" {...register("description")} />
              <FieldError message={errors.description?.message} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
