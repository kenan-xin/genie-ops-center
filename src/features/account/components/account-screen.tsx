"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { authClient, isAdminRole } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { ChangePasswordPanel } from "./change-password-panel";
import { ProfilePanel } from "./profile-panel";
import { SessionsPanel } from "./sessions-panel";

type Section = "profile" | "password" | "sessions";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "sessions", label: "Devices & sessions" },
];

/**
 * Account settings body (FR-ACCT): identity banner + left sub-nav that swaps a
 * single active panel in. Shared by both chromes — the customer workspace
 * (`(workspace)/account`) and the admin console (`(admin)/admin/account`) —
 * since there's one account surface per user regardless of which shell they
 * reach it from. The outer padding/max-width wrapper is chrome-specific and
 * lives in each route's `page.tsx` (workspace self-pads via `cs-hubpad`; the
 * admin shell's `<main>` already pads), so this renders wrapper-free.
 *
 * Sub-nav selection is trivial client state (no route change), so a plain
 * `useState` is enough per AGENTS.md's state-tiering — no Zustand store needed.
 */
export function AccountScreen() {
  const [section, setSection] = useState<Section>("profile");
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <>
      <header className="flex items-center gap-[13px]">
        <span
          aria-hidden
          className="flex size-[46px] shrink-0 items-center justify-center bg-[var(--ink)] font-sans text-title font-extrabold text-background"
        >
          {isPending ? "" : initials(user?.name)}
        </span>
        {isPending ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <div className="min-w-0">
            <div className="truncate font-sans text-display font-extrabold tracking-[-0.01em] text-foreground">
              {user?.name}
            </div>
            <div className="truncate text-small text-[var(--ink2)]">
              {user?.email} · {isAdminRole(user?.role) ? "Admin" : "Member"}
            </div>
          </div>
        )}
      </header>

      <div className="acct-grid mt-[22px]">
        <nav
          aria-label="Account settings"
          className="flex flex-col border border-[var(--line)] bg-[var(--surface)]"
        >
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full border-l-[3px] px-3 py-[9px] text-left font-sans text-body transition-colors",
                  active
                    ? "border-[var(--brand)] bg-[var(--brandtint)] font-bold text-[var(--brandink)]"
                    : "border-transparent text-[var(--ink2)]",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {section === "profile" ? <ProfilePanel /> : null}
          {section === "password" ? <ChangePasswordPanel /> : null}
          {section === "sessions" ? <SessionsPanel /> : null}
        </div>
      </div>
    </>
  );
}

/** First letters of up to two name parts, e.g. "Ada Lovelace" → "AL". */
function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}
