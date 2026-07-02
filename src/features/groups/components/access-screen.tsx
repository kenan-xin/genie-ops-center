"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SegmentedControl } from "@/components/ui/segmented";

import { AccessOverview } from "./access-overview";
import { GrantsPanel } from "./grants-panel";

type Mode = "grants" | "overview";

/**
 * The Access screen (FR-ADM-O). The prototype's `Access` (grants) and
 * `Overview` (explorer) are two separate top-level nav items; this app's
 * admin nav folds them into one "Access" item (see admin-nav-items.ts), so
 * they're offered here as a mode toggle instead — `mode`/`group` live in the
 * URL so the inspector's "Open in Access →" handoff can deep-link straight
 * into Grants for a specific group.
 */
export function AccessScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode: Mode = searchParams.get("mode") === "overview" ? "overview" : "grants";
  const groupId = searchParams.get("group");

  function updateParams(next: { mode?: Mode; group?: string }) {
    const params = new URLSearchParams(searchParams);
    if (next.mode) params.set("mode", next.mode);
    if (next.group) params.set("group", next.group);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">Access</h1>
        <p className="text-small text-[var(--ink2)]">
          Grant solutions to a group, or explore who can reach what — both read the same membership
          ∩ grant union.
        </p>
      </header>

      <SegmentedControl
        options={[
          { value: "grants", label: "Grants" },
          { value: "overview", label: "Overview" },
        ]}
        value={mode}
        onValueChange={(next) => updateParams({ mode: next })}
      />

      {mode === "grants" ? (
        <GrantsPanel
          groupId={groupId}
          onGroupChange={(id) => updateParams({ mode: "grants", group: id })}
        />
      ) : (
        <AccessOverview />
      )}
    </div>
  );
}
