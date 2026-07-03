"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { FieldError } from "@/components/ui/form-feedback";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SlideOver,
  SlideOverContent,
  SlideOverFooter,
  SlideOverHeader,
  SlideOverTitle,
} from "@/components/ui/slide-over";
import { TransferList, type TransferItem } from "@/components/ui/transfer-list";
import { useToast } from "@/components/ui/toast";

import { useDeleteGroup, useGroupQuery, useSetMembers, useUpdateGroup } from "../api/groups";
import { updateGroupSchema, type UpdateGroupValues } from "../schemas/group";

/**
 * Group inspector (FR-ADM-G-03/04/05) — a right-edge slide-over triggered from
 * the directory row, not a route. Name/description autosave on blur; members
 * use the shared TransferList (K2). Granted solutions moved to the dedicated
 * Access screen (FR-ADM-O) — this shows only a handoff card + grant count.
 */
export function GroupInspector({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <SlideOver open={open} onOpenChange={onOpenChange}>
      <SlideOverContent>
        {groupId ? (
          <GroupInspectorBody groupId={groupId} onClose={() => onOpenChange(false)} />
        ) : null}
      </SlideOverContent>
    </SlideOver>
  );
}

function GroupInspectorBody({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data, isPending, isError, error } = useGroupQuery(groupId);
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const setMembers = useSetMembers();

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
      onClose();
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-5">
        <p className="text-small text-[var(--error)]">
          {(error as { message: string } | undefined)?.message || "Couldn't load this group."}
        </p>
      </div>
    );
  }

  const { detail, members } = data;
  const memberItems: TransferItem[] = members.map((m) => ({
    id: m.id,
    label: m.name,
    description: m.email,
  }));

  async function commitMembers(userIds: string[]) {
    try {
      await setMembers.mutateAsync({ groupId, userIds });
      toast({ tone: "success", description: "Membership updated." });
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  return (
    <>
      <InspectorHeader
        groupId={groupId}
        name={detail.name}
        description={detail.description}
        onSaved={async (values) => {
          try {
            await updateGroup.mutateAsync(values);
          } catch (e) {
            toast({ tone: "error", description: (e as { message: string }).message });
          }
        }}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-5 mt-4 flex items-center justify-between gap-3 border border-[var(--line)] bg-[var(--panel)] p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-small font-semibold text-foreground">
              Solution access is managed in Access
            </span>
            <span className="font-mono text-mono-xs text-[var(--ink3)]">
              {detail.solutionIds.length} GRANTED
            </span>
          </div>
          <Link
            href={`/admin/groups/access?mode=grants&group=${groupId}`}
            className="shrink-0 text-small font-semibold text-[var(--brandink)] hover:underline"
          >
            Open in Access →
          </Link>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink2)] uppercase">
              Members
            </h2>
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
            className="gap-2.5"
            paneHeightClassName="max-h-[300px]"
            showHeaderActions={false}
          />
        </div>
      </div>

      <SlideOverFooter className="justify-between">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void handleDelete()}
          disabled={deleteGroup.isPending}
        >
          Delete group
        </Button>
        <div className="flex items-center gap-3">
          <span className="font-mono text-mono-xs text-[var(--ink3)]">
            Changes save automatically
          </span>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </SlideOverFooter>
    </>
  );
}

function InspectorHeader({
  groupId,
  name,
  description,
  onSaved,
}: {
  groupId: string;
  name: string;
  description: string | null;
  onSaved: (values: UpdateGroupValues) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateGroupValues>({
    resolver: zodResolver(updateGroupSchema),
    values: { id: groupId, name, description: description ?? "" },
  });

  const nameField = register("name");
  const descriptionField = register("description");
  const commit = handleSubmit((values) => onSaved(values));

  return (
    <SlideOverHeader className="gap-1.5">
      <SlideOverTitle className="sr-only">{name || "Untitled group"}</SlideOverTitle>
      <span className="font-mono text-mono-xs font-semibold tracking-[0.09em] text-[var(--brandink)] uppercase">
        Editing group
      </span>
      <input
        {...nameField}
        onBlur={(e) => {
          void nameField.onBlur(e);
          if (isDirty) void commit();
        }}
        aria-label="Group name"
        placeholder="Group name"
        className="-mx-1 border border-transparent bg-transparent px-1 py-0.5 font-sans text-cardhead font-extrabold tracking-[-0.01em] text-foreground outline-none transition-colors hover:border-[var(--line2)] focus:border-[var(--brand)] focus:bg-[var(--surface)]"
      />
      <FieldError message={errors.name?.message} />
      <input
        {...descriptionField}
        onBlur={(e) => {
          void descriptionField.onBlur(e);
          if (isDirty) void commit();
        }}
        aria-label="Group description"
        placeholder="Add a description"
        className="-mx-1 border border-transparent bg-transparent px-1 py-0.5 text-small text-[var(--ink3)] outline-none transition-colors hover:border-[var(--line2)] focus:border-[var(--brand)] focus:bg-[var(--surface)] focus:text-foreground"
      />
    </SlideOverHeader>
  );
}
