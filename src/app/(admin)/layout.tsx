import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IdleTimeout } from "@/components/idle-timeout";
import { ThemeToggle } from "@/components/theme-toggle";
import { getServerAuth, isAdmin } from "@/server/authz";

// Server-enforced admin boundary: /admin is admin-only. The tRPC adminProcedure
// guards mutations; this guards the route itself so the pages never render for
// a non-admin. (tech-plan → admin boundary in server layouts.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth(await headers());
  if (auth.status === "unauthenticated") redirect("/admin/login");
  if (auth.status === "password-change-required") redirect("/change-password");
  if (!isAdmin(auth.user)) redirect("/"); // authenticated, but not an admin

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg)" }}>
      <IdleTimeout />
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--brand)",
          }}
        >
          Admin portal
        </span>
        <div className="flex items-center gap-4">
          <Link href="/" style={{ fontSize: "var(--t-sm)", color: "var(--ink2)" }}>
            Back to workspace
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-6 py-8" style={{ maxWidth: "var(--content-wide)", width: "100%" }}>
        {children}
      </main>
    </div>
  );
}
