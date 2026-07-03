import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SolutionListPage } from "@/features/solutions-hub/components/solution-list-page";

/**
 * Favorites (FR-HUB-09). Access-gated by the same predicate as the hub — a
 * starred solution that's later revoked/archived/drafted drops out immediately
 * even though its `favorite` row persists (a cache, not access).
 */
export default function FavoritesPage() {
  prefetch(trpc.solutionsHub.favorites.queryOptions());
  return (
    <HydrateClient>
      <SolutionListPage
        title="Favorites"
        subtitle="Solutions you've starred for quick access."
        empty={{
          icon: "☆",
          heading: "No favorites yet",
          body: "Tap the ☆ on any solution to pin it here.",
        }}
      />
    </HydrateClient>
  );
}
