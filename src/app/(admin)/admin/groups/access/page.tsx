import { Suspense } from "react";

import { AccessScreen } from "@/features/groups/components/access-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Access screen (FR-ADM-O-01): grants (group → solutions) + the overview
// explorer, toggled client-side. Prefetches the group list the Grants mode
// needs by default; `AccessScreen` reads `mode`/`group` search params, which
// requires the Suspense boundary Next.js mandates for `useSearchParams`.
export default function AdminAccessPage() {
  prefetch(trpc.groups.list.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AccessScreen />
      </Suspense>
    </HydrateClient>
  );
}
