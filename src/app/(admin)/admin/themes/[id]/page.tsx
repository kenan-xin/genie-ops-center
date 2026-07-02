import { ThemeBuilder } from "@/features/themes/components/theme-builder";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Theme Builder for a specific theme (FR-ADM-T-02/03) — thin route, same
// screen as the index route with the saved-theme swatch strip selecting `id`.
// The builder reads the selected theme's config off the `themes.list` result
// (already includes each theme's full config), so only that needs prefetching.
export default async function ThemeBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.themes.list.queryOptions());
  return (
    <HydrateClient>
      <ThemeBuilder selectedId={id} />
    </HydrateClient>
  );
}
