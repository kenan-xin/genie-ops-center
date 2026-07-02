"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";

import { authClient } from "@/lib/auth-client";

/**
 * Bottom sidebar footer (prototype line 222–228): avatar (initials) + name +
 * role chip, linking to Account, with a ⏻ sign-out. The name/initials/role come
 * from the server-resolved session (passed in as props — the server layout owns
 * auth, this is pure presentation). Sign-out clears the better-auth session and
 * returns to /login.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}

export function UserFooter({ name, role }: { name: string; role: string }) {
  const router = useRouter();

  const roleLabel = role
    .split(",")
    .map((r) => r.trim())
    .includes("admin")
    ? "ADMIN"
    : "WORKSPACE MEMBER";

  const signOut = async () => {
    await authClient.signOut();
    router.replace("/login?notice=signed-out");
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
        className="ws-nav-item"
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
            {roleLabel}
          </span>
        </span>
      </Link>
      <button
        type="button"
        title="Sign out"
        onClick={() => void signOut()}
        className="ws-nav-item"
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
