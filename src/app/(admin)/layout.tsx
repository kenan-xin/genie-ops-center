import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

// ponytail: minimal admin chrome. The real admin-only guard (server layout
// redirect + adminProcedure) lands with auth (ticket 03).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg)" }}>
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
