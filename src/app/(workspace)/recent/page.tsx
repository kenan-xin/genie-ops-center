import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SolutionListPage } from "@/features/solutions-hub/components/solution-list-page";

/**
 * Recently opened (FR-HUB-09). Most-recent first, capped at 6, access-gated by
 * the same predicate as the hub — a revoked/archived/drafted solution drops out
 * immediately even though its `recent` row persists (a cache, not access).
 */
export default function RecentPage() {
  prefetch(trpc.solutionsHub.recents.queryOptions());
  return (
    <HydrateClient>
      <SolutionListPage
        variant="recents"
        title="Recently opened"
        subtitle="Solutions you've opened, most recent first."
        empty={{
          icon: "↻",
          heading: "Nothing here yet",
          body: "Open a solution and it'll show up here for quick access.",
        }}
      />
    </HydrateClient>
  );
}
