"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TransferList, type TransferItem } from "@/components/ui/transfer-list";
import { useToast } from "@/components/ui/toast";

import { useGroupQuery, useGroupsQuery, useSetSolutions } from "../api/groups";

/**
 * Access · Grants (FR-ADM-O-01 move): grant solutions to one group at a time
 * via a group selector + the shared TransferList (K2) — moved here from the
 * inspector so "who's granted what" lives in one place (Access), separate
 * from "who's in the group" (the inspector).
 */
export function GrantsPanel({
  groupId,
  onGroupChange,
}: {
  groupId: string | null;
  onGroupChange: (id: string) => void;
}) {
  const { data: groups, isPending, isError, error } = useGroupsQuery();

  useEffect(() => {
    if (!groupId && groups && groups.length > 0) onGroupChange(groups[0]!.id);
  }, [groupId, groups, onGroupChange]);

  if (isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (isError) {
    return (
      <p className="text-small text-[var(--error)]">
        {(error as { message: string }).message || "Couldn't load groups."}
      </p>
    );
  }
  if (groups.length === 0) {
    return (
      <EmptyState
        title="No groups yet"
        description="Create a group under Groups, then come back here to grant it solutions."
      />
    );
  }

  const activeId = groupId && groups.some((g) => g.id === groupId) ? groupId : groups[0]!.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase">
          Group
        </span>
        <Select
          items={groups.map((g) => ({ value: g.id, label: g.name }))}
          value={activeId}
          onValueChange={onGroupChange}
          className="max-w-[320px]"
        />
      </div>
      <GrantsTransfer groupId={activeId} />
    </div>
  );
}

function GrantsTransfer({ groupId }: { groupId: string }) {
  const { toast } = useToast();
  const { data, isPending, isError, error } = useGroupQuery(groupId);
  const setSolutions = useSetSolutions();

  if (isPending) {
    return <Skeleton className="h-[clamp(380px,52vh,640px)] w-full" />;
  }
  if (isError || !data) {
    return (
      <p className="text-small text-[var(--error)]">
        {(error as { message: string } | undefined)?.message || "Couldn't load this group."}
      </p>
    );
  }

  const items: TransferItem[] = data.solutions.map((s) => ({
    id: s.id,
    label: s.name,
    description: s.archived ? "Archived" : s.status,
    mono: s.monogram ?? undefined,
  }));

  async function commit(solutionIds: string[]) {
    try {
      await setSolutions.mutateAsync({ groupId, solutionIds });
      toast({ tone: "success", description: "Granted solutions updated." });
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  return (
    <TransferList
      items={items}
      value={data.detail.solutionIds}
      onChange={(ids) => void commit(ids)}
      availableLabel="Catalog"
      targetLabel="Granted"
    />
  );
}
