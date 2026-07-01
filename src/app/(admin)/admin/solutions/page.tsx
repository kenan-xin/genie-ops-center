import { SolutionsDirectory } from "@/features/solutions/components/solutions-directory";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: Solutions (FR-ADM-S) — thin route composing the feature slice.
export default function SolutionsPage() {
  prefetch(trpc.solutions.list.queryOptions({ sort: "updated" }));
  return (
    <HydrateClient>
      <SolutionsDirectory />
    </HydrateClient>
  );
}
