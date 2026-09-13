import { CategoriesDirectory } from "@/features/categories/components/categories-directory";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: solution categories — thin route composing the feature slice.
export default function CategoriesPage() {
  prefetch(trpc.categories.list.queryOptions());
  return (
    <HydrateClient>
      <CategoriesDirectory />
    </HydrateClient>
  );
}
