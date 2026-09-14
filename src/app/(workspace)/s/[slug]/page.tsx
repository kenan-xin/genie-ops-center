import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { getServerAuth } from "@/server/authz";
import { caller } from "@/server/trpc/caller";
import { resolveViewerSurface } from "@/features/solution-viewer/server/resolve";
import { ChatSlot } from "@/features/solution-viewer/components/chat-slot";
import { EmbeddedView } from "@/features/solution-viewer/components/embedded-view";
import { NotOpenableNotice } from "@/features/solution-viewer/components/not-openable-notice";
import { StatusNotice } from "@/features/solution-viewer/components/status-notice";
import { ViewerToolbar } from "@/features/solution-viewer/components/viewer-toolbar";

/**
 * `/s/[slug]` viewer (FR-VIEW). Server-side resolution applies the two distinct
 * guards (see/run) and dispatches to one surface per branch; no client-side
 * access reasoning. `recordRecent` fires once on a successful `see` (the hub
 * already exposed that mutation and re-asserts see).
 *
 * Status gating (FR-VIEW-05): maintenance/down → non-interactive notice; draft
 * is never openable (the see guard 404s it — the hub dims/hides drafts). Native
 * has no runtime in foundation → not-openable notice (only reachable via a
 * direct visit; the hub hides native from the catalogue).
 */
export default async function SolutionViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getServerAuth(await headers());
  // The (workspace) layout already redirects unauthenticated / password-change
  // sessions away, so an authenticated user is guaranteed here. Guard anyway.
  if (auth.status !== "authenticated") notFound();

  let surface;
  try {
    surface = await resolveViewerSurface(auth.user, slug);
  } catch (err) {
    // Draft/archived/missing collapse to 404 (existence must not leak); a
    // no-grant is 403. Both render as not-found so a probe learns nothing.
    if (err instanceof TRPCError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) {
      notFound();
    }
    throw err;
  }

  // Record the open to recent on a successful see (FR-HUB-09). Best-effort: a
  // failure here (e.g. a race with archiving) must not break the view.
  caller.solutionsHub.recordRecent({ solutionId: surface.solution.id }).catch(() => {});

  const { solution: s } = surface;
  const surfaceOwnsScrolling = surface.kind === "chat-slot" || surface.kind === "embedded";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ViewerToolbar name={s.name} type={s.type} />
      <div style={{ flex: 1, minHeight: 0, overflow: surfaceOwnsScrolling ? "hidden" : "auto" }}>
        {surface.kind === "status-notice" ? (
          <StatusNotice status={surface.status} name={s.name} />
        ) : surface.kind === "embedded" ? (
          <EmbeddedView iframeUrl={surface.iframeUrl} allowFullscreen={surface.allowFullscreen} />
        ) : surface.kind === "chat-slot" ? (
          <ChatSlot
            accentColor={s.accentColor}
            accentColorInvert={s.accentColorInvert}
            feedbackEnabled={surface.feedbackEnabled}
            monogram={s.monogram}
            name={s.name}
            solutionId={s.id}
            starterPrompts={surface.starterPrompts}
            welcomeMessage={surface.welcomeMessage}
          />
        ) : (
          <NotOpenableNotice name={s.name} />
        )}
      </div>
    </div>
  );
}
