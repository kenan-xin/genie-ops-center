import { ThemeEditor } from "@/features/themes/components/theme-editor";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Theme editor + live device preview (FR-ADM-T-02/03) — thin route.
export default async function ThemeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.themes.get.queryOptions({ id }));
  return (
    <HydrateClient>
      <ThemeEditor themeId={id} />
    </HydrateClient>
  );
}
