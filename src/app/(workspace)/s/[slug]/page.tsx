import { Placeholder } from "@/components/placeholder";

export default async function SolutionViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Placeholder
      eyebrow="Solution"
      title={slug}
      note="The solution viewer (chat / embedded iframe) lands in a later ticket."
    />
  );
}
