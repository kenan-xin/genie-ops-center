"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TransferList, type TransferItem } from "@/components/ui/transfer-list";
import { useToast } from "@/components/ui/toast";

import {
  useDeleteGroup,
  useGroupQuery,
  useSetMembers,
  useSetSolutions,
  useUpdateGroup,
} from "../api/groups";
import { updateGroupSchema, type UpdateGroupValues } from "../schemas/group";

/**
 * Group inspector (FR-ADM-G-03/04/05). Members and granted solutions are each
 * edited through a TransferList whose value is the whole desired set; on
 * change we persist the diff-synced set. Destructive actions (delete group,
 * clearing a list) confirm first.
 */
export function GroupInspector({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data, isPending, isError, error } = useGroupQuery(groupId);
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const setMembers = useSetMembers();
  const setSolutions = useSetSolutions();

  async function handleDelete() {
    if (!data) return;
    const ok = await confirm({
      title: `Delete "${data.detail.name}"?`,
      description:
        "Members keep access to solutions through any other groups that grant them. This can't be undone.",
      confirmLabel: "Delete group",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteGroup.mutateAsync({ id: groupId });
      toast({ tone: "success", description: `Deleted "${data.detail.name}".` });
      router.push("/admin/groups");
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-small text-[var(--error)]">
        {(error as { message: string } | undefined)?.message || "Couldn't load this group."}
      </p>
    );
  }

  const { detail, members, solutions } = data;
  const memberItems: TransferItem[] = members.map((m) => ({
    id: m.id,
    label: m.name,
    description: m.email,
  }));
  const solutionItems: TransferItem[] = solutions.map((s) => ({
    id: s.id,
    label: s.name,
    description: s.archived ? "Archived" : s.status,
  }));

  async function commitMembers(userIds: string[]) {
    try {
      await setMembers.mutateAsync({ groupId, userIds });
      toast({ tone: "success", description: "Membership updated." });
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  async function commitSolutions(solutionIds: string[]) {
    try {
      await setSolutions.mutateAsync({ groupId, solutionIds });
      toast({ tone: "success", description: "Granted solutions updated." });
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <RenameBar
        groupId={groupId}
        name={detail.name}
        description={detail.description}
        onSubmit={async (values) => {
          try {
            await updateGroup.mutateAsync(values);
            toast({ tone: "success", description: "Group updated." });
          } catch (e) {
            toast({ tone: "error", description: (e as { message: string }).message });
          }
        }}
        onDelete={() => void handleDelete()}
        submitting={updateGroup.isPending || deleteGroup.isPending}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-cardhead font-extrabold tracking-[-0.01em]">Members</h2>
          {detail.memberIds.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={setMembers.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Remove all members?",
                  description: "Everyone in this group loses access to its granted solutions.",
                  confirmLabel: "Remove all",
                  tone: "danger",
                });
                if (ok) void commitMembers([]);
              }}
            >
              Remove all
            </Button>
          ) : null}
        </div>
        <p className="text-small text-[var(--ink2)]">
          Disabled people aren&rsquo;t selectable. Pending invites stay selectable.
        </p>
        <TransferList
          items={memberItems}
          value={detail.memberIds}
          onChange={(ids) => void commitMembers(ids)}
          availableLabel="Available people"
          targetLabel="Members"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-cardhead font-extrabold tracking-[-0.01em]">
            Granted solutions
          </h2>
          {detail.solutionIds.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={setSolutions.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Revoke all grants?",
                  description:
                    "Members lose access to these solutions unless another group grants them.",
                  confirmLabel: "Revoke all",
                  tone: "danger",
                });
                if (ok) void commitSolutions([]);
              }}
            >
              Revoke all
            </Button>
          ) : null}
        </div>
        <p className="text-small text-[var(--ink2)]">
          Access = membership ∩ grant. Archived solutions stay granted but aren&rsquo;t reachable.
        </p>
        <TransferList
          items={solutionItems}
          value={detail.solutionIds}
          onChange={(ids) => void commitSolutions(ids)}
          availableLabel="Available solutions"
          targetLabel="Granted"
        />
      </section>
    </div>
  );
}

function RenameBar({
  groupId,
  name,
  description,
  onSubmit,
  onDelete,
  submitting,
}: {
  groupId: string;
  name: string;
  description: string | null;
  onSubmit: (values: UpdateGroupValues) => Promise<void>;
  onDelete: () => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateGroupValues>({
    resolver: zodResolver(updateGroupSchema),
    defaultValues: { id: groupId, name, description: description ?? "" },
  });

  // Re-seed when the server value changes (e.g. after invalidation).
  useEffect(() => {
    reset({ id: groupId, name, description: description ?? "" });
  }, [groupId, name, description, reset]);

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        if (!isDirty) return;
        try {
          await onSubmit(values);
        } catch (e) {
          setError("root", { message: (e as { message: string }).message });
        }
      })}
      className="flex flex-col gap-3 border-b border-[var(--line)] pb-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="group-name">Name</Label>
          <Input id="group-name" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <Button type="submit" disabled={!isDirty || submitting} className="mt-[22px]">
          Save
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-description">Description</Label>
        <Input id="group-description" {...register("description")} />
        <FieldError message={errors.description?.message} />
      </div>
      <FormError message={errors.root?.message} />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={submitting}
        >
          Delete group
        </Button>
      </div>
    </form>
  );
}
