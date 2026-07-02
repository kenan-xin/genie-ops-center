import { GroupsDirectory } from "@/features/groups/components/groups-directory";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Deep-link entry for a single group (e.g. the People directory's "jump to
// group" links, ticket 06). The inspector is a slide-over, not a route — this
// renders the same directory and seeds it open for `id` on mount, so a direct
// link still lands the admin on the right group.
export default async function GroupDeepLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.groups.list.queryOptions());
  prefetch(trpc.groups.get.queryOptions({ id }));

  return (
    <HydrateClient>
      <GroupsDirectory initialGroupId={id} />
    </HydrateClient>
  );
}
