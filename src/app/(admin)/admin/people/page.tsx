import { PeopleDirectory } from "@/features/users/components/people-directory";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: People (FR-ADM-P). Thin RSC shell — prefetches the default listing
// so the client table hydrates instead of flashing a loading state; all
// search/sort/mutation state lives in the client component.
export default function AdminPeoplePage() {
  prefetch(trpc.users.list.queryOptions({ sort: "name" }));

  return (
    <HydrateClient>
      <PeopleDirectory />
    </HydrateClient>
  );
}
