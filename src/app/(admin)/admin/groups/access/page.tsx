import { AccessOverview } from "@/features/groups/components/access-overview";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Access Overview explorer (FR-ADM-O-01). Prefetches the default "by solution"
// view so it hydrates; the "by person" toggle fetches lazily.
export default function AdminAccessOverviewPage() {
  prefetch(trpc.groups.overviewBySolution.queryOptions());

  return (
    <HydrateClient>
      <AccessOverview />
    </HydrateClient>
  );
}
