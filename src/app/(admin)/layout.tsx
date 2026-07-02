import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuth, isAdmin } from "@/server/authz";

import { AdminChrome } from "./_components/admin-chrome";

// Server-enforced admin boundary: /admin is admin-only. The tRPC adminProcedure
// guards mutations; this guards the route itself so the pages never render for
// a non-admin. (tech-plan → admin boundary in server layouts.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth(await headers());
  if (auth.status === "unauthenticated") redirect("/admin/login");
  if (auth.status === "password-change-required") redirect("/change-password");
  if (!isAdmin(auth.user)) redirect("/"); // authenticated, but not an admin

  return <AdminChrome userName={auth.user.name}>{children}</AdminChrome>;
}
