import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuth } from "@/server/authz";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { WorkspaceChrome } from "./_components/workspace-chrome";

/**
 * Server-enforced auth boundary for the whole customer workspace surface
 * (hub, favorites, account, /s/[slug]). Mirrors (admin)/layout.tsx:
 * unauthenticated → /login, must-change-password → /change-password — BEFORE any
 * chrome renders, so a future data-bearing RSC can never sit behind a public
 * shell. The client chrome (WorkspaceChrome) is pure presentation; auth lives
 * here, server-side.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth(await headers());
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "password-change-required") redirect("/change-password");

  // PINNED favorites rail self-fetches via useFavorites() (pinned-favorites.tsx);
  // prefetch here so it hydrates with no flash and no waterfall, same pattern
  // as favorites/page.tsx.
  prefetch(trpc.solutionsHub.favorites.queryOptions());

  // SidebarCategories self-fetches; prefetch so the rail hydrates with no flash.
  prefetch(trpc.categories.sidebar.queryOptions());

  return (
    <HydrateClient>
      <WorkspaceChrome userName={auth.user.name} userRole={auth.user.role}>
        {children}
      </WorkspaceChrome>
    </HydrateClient>
  );
}
