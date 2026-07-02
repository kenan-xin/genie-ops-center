import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SolutionsHub } from "@/features/solutions-hub/components/solutions-hub";

/**
 * Solutions hub (FR-HUB). Thin route: prefetch the access-gated list so the
 * catalogue renders on first paint, then hydrate the interactive toolbar
 * (search/type/sort/progressive-load) onto it.
 */
export default function HubPage() {
  prefetch(trpc.solutionsHub.list.queryOptions({ sort: "recent" }));
  return (
    <HydrateClient>
      <SolutionsHub />
    </HydrateClient>
  );
}
