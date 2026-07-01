import { GroupsDirectory } from "@/features/groups/components/groups-directory";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: Groups directory (FR-ADM-G-01/02). Thin RSC shell — prefetches the
// listing so the table hydrates; search/create/mutation live client-side.
export default function AdminGroupsPage() {
  prefetch(trpc.groups.list.queryOptions());

  return (
    <HydrateClient>
      <GroupsDirectory />
    </HydrateClient>
  );
}
