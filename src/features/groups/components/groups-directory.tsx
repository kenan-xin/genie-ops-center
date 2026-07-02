"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
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
import { GroupInspector } from "./group-inspector";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/**
 * Groups directory (FR-ADM-G-01/02): search, create, select → inspector
 * slide-over. `initialGroupId` seeds the slide-over open when this component
 * is rendered from the `/admin/groups/[id]` deep-link (People directory
 * "jump to group" links) — the directory itself never route-navigates for a
 * row click, only for that initial deep-link entry.
 */
export function GroupsDirectory({ initialGroupId }: { initialGroupId?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialGroupId ?? null);
  const { data: groups, isPending, isError, error } = useGroupsQuery(search);

  const term = search.trim();

  function closeInspector() {
    setOpenId(null);
    if (pathname !== "/admin/groups") router.replace("/admin/groups");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">Groups</h1>
        <p className="text-small text-[var(--ink2)]">
          A group is a set of people. Open a group to manage who&rsquo;s in it — then grant
          solutions to the group over in Access.
        </p>
      </header>

      <div className="flex items-center gap-2 border border-[var(--brand)]/25 bg-[var(--brandtint)] px-3.5 py-2.5">
        <span className="shrink-0 font-mono text-mono-xs font-semibold tracking-[0.08em] text-[var(--brandink)] uppercase">
          How access works
        </span>
        <span className="text-small text-[var(--brandink)]">
          People belong to groups here; groups are granted solutions in{" "}
          <span className="font-semibold">Access</span>. A person can open a solution if any of
          their groups grants it.
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search groups…"
          className="max-w-[320px]"
        />
        <Button onClick={() => setCreateOpen(true)}>New group</Button>
      </div>

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
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Members</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id} className="cursor-pointer" onClick={() => setOpenId(g.id)}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-semibold text-foreground">{g.name}</span>
                      {g.description ? (
                        <span className="text-mono-xs text-[var(--ink3)]">{g.description}</span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[var(--ink2)]">{g.memberCount}</TableCell>
                  <TableCell className="text-right text-[var(--line)]">›</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setOpenId(id)}
      />
      <GroupInspector
        groupId={openId}
        open={openId !== null}
        onOpenChange={(next) => {
          if (!next) closeInspector();
        }}
      />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
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
      onCreated(created.id);
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
              Add people from the group inspector after creating it — grant it solutions from
              Access.
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
