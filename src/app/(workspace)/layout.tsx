import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuth } from "@/server/authz";

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

  // Favorites cache for the PINNED rail. The granted+unarchived predicate and
  // persistence land with the favorites feature ticket; the shell renders the
  // rail off an empty list until then (matching the prototype's sideFavHas gate).
  const favorites: { id: string; slug: string; name: string }[] = [];

  return (
    <WorkspaceChrome userName={auth.user.name} userRole={auth.user.role} favorites={favorites}>
      {children}
    </WorkspaceChrome>
  );
}
