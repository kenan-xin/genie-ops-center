import { ThemeList } from "@/features/themes/components/theme-list";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: Themes (FR-ADM-T-01) — thin route composing the feature slice.
export default function ThemesPage() {
  prefetch(trpc.themes.list.queryOptions());
  return (
    <HydrateClient>
      <ThemeList />
    </HydrateClient>
  );
}
