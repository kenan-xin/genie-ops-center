"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { authClient, isAdminRole } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { ChangePasswordPanel } from "./_components/change-password-panel";
import { ProfilePanel } from "./_components/profile-panel";
import { SessionsPanel } from "./_components/sessions-panel";

type Section = "profile" | "password" | "sessions";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "sessions", label: "Devices & sessions" },
];

/**
 * Account settings (FR-ACCT): IA overhaul per the design audit (§C account,
 * prototype lines 329-399) — a profile-header banner replaces the old generic
 * "Account" H1, and a left sub-nav swaps a single active panel in rather than
 * stacking all three settings cards at once. Sub-nav selection is trivial
 * client state (no route change), so a plain `useState` is enough per
 * AGENTS.md's state-tiering — no Zustand store needed.
 */
export default function AccountPage() {
  const [section, setSection] = useState<Section>("profile");
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <div className="cs-hubpad" style={{ maxWidth: "var(--content-wide)" }}>
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
                  "w-full border-l-[3px] px-[10px] py-2 text-left font-sans text-body transition-colors",
                  active
                    ? "border-[var(--brand)] bg-[var(--brandtint)] font-bold text-[var(--brandink)]"
                    : "border-transparent text-[var(--ink2)] hover:bg-[var(--panel)]",
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
    </div>
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
