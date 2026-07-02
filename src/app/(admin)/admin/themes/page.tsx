import { ThemeBuilder } from "@/features/themes/components/theme-builder";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: Theme Builder (FR-ADM-T) — thin route composing the feature slice.
// No id in the URL yet: the builder lands on the first saved theme once the
// list loads (or shows the empty state if there isn't one).
export default function ThemesPage() {
  prefetch(trpc.themes.list.queryOptions());
  return (
    <HydrateClient>
      <ThemeBuilder selectedId={null} />
    </HydrateClient>
  );
}
