import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuth } from "@/server/authz";
import { caller } from "@/server/trpc/caller";

import { WorkspaceChrome } from "./_components/workspace-chrome";

/**
 * Server-enforced auth boundary for the whole customer workspace surface
 * (hub, recent, favorites, account, /s/[slug]). Mirrors (admin)/layout.tsx:
 * unauthenticated → /login, must-change-password → /change-password — BEFORE any
 * chrome renders, so a future data-bearing RSC can never sit behind a public
 * shell. The client chrome (WorkspaceChrome) is pure presentation; auth lives
 * here, server-side.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth(await headers());
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "password-change-required") redirect("/change-password");

  // PINNED favorites rail. `favorites` is access-gated by the same predicate as
  // the hub (granted + unarchived + customer-visible), so a revoked/archived/
  // drafted favorite never renders in the rail. The first 6 drive the sidebar;
  // the rest are reachable from /favorites.
  const favorites = (await caller.solutionsHub.favorites()).slice(0, 6).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
  }));

  return (
    <WorkspaceChrome userName={auth.user.name} userRole={auth.user.role} favorites={favorites}>
      {children}
    </WorkspaceChrome>
  );
}
