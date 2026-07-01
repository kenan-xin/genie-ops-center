import Link from "next/link";

import { GroupInspector } from "@/features/groups/components/group-inspector";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Group inspector (FR-ADM-G-03/04/05) — the "Jump to group" target linked
// from the People directory (ticket 06). Thin RSC shell; prefetches the
// inspector payload + both selectable catalogs.
export default async function GroupInspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.groups.get.queryOptions({ id }));

  return (
    <HydrateClient>
      <div className="mb-4">
        <Link href="/admin/groups" className="text-small text-[var(--ink2)] hover:underline">
          ← Back to groups
        </Link>
      </div>
      <GroupInspector groupId={id} />
    </HydrateClient>
  );
}
