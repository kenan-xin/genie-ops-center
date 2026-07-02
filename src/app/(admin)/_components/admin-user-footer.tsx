"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";

import { authClient } from "@/lib/auth-client";

/**
 * Bottom sidebar footer (prototype line 222-228, same anatomy as the
 * workspace shell's `UserFooter`): avatar (initials) + name + role chip,
 * linking to Account, with a ⏻ sign-out. Every user who reaches this shell
 * has already cleared the `isAdmin` gate in `(admin)/layout.tsx`, so the role
 * chip is fixed "ADMIN" rather than derived — Admin framing in place of the
 * workspace footer's "WORKSPACE OWNER" / "WORKSPACE MEMBER".
 *
 * The identity link goes to `/account` (the shared, workspace-hosted account
 * screen — there's no admin-only account page) which doubles as the way back
 * into the customer workspace, replacing the old top-bar's explicit
 * "Back to workspace" link.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}

export function AdminUserFooter({ name }: { name: string }) {
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.replace("/admin/login");
  };

  return (
    <div
      style={{
        padding: 12,
        borderTop: "1px solid var(--line2)",
        display: "flex",
        alignItems: "center",
        gap: 9,
      }}
    >
      <Link
        href="/account"
        className="adm-nav-item"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          flex: 1,
          minWidth: 0,
          padding: 2,
          margin: -2,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            background: "var(--ink)",
            color: "var(--bg)",
            fontSize: "var(--t-xs)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(name)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--t-sm)",
              fontWeight: 600,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
          <span
            style={{
              display: "block",
              font: "500 var(--m-sm) var(--font-mono)",
              color: "var(--ink3)",
            }}
          >
            ADMIN
          </span>
        </span>
      </Link>
      <button
        type="button"
        title="Sign out"
        onClick={() => void signOut()}
        className="adm-nav-item"
        style={{
          cursor: "pointer",
          color: "var(--ink3)",
          fontSize: "var(--t-title)",
          background: "transparent",
          border: "none",
          padding: 0,
          lineHeight: 1,
        }}
      >
        ⏻
      </button>
    </div>
  );
}
