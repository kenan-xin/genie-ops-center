"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { SESSION_MINUTES } from "@/components/idle-timeout";
import { authClient } from "@/lib/auth-client";
import { relativeTime } from "@/lib/relative-time";

import { AccountPanel, AccountPanelHeading } from "./account-panel";

const SESSIONS_KEY = ["account", "sessions"] as const;

/**
 * Devices & sessions (FR-ACCT-03, prototype lines 370-384 — panel heading is
 * "Active sessions", the sub-nav label stays "Devices & sessions"). Self-service:
 * lists the user's own active sessions via better-auth's client SDK (scoped to
 * their cookie), marks the current device, and revokes others. Destructive
 * actions confirm first (FR-SYS-02). See docs/tech-plan/account-sessions — the
 * admin force-sign-out (ticket 06) is a *separate* privileged server call, not
 * this path.
 *
 * The prototype's "Trusted devices & timeout" card (lines 385-395) ships here
 * as an honest hybrid rather than the earlier full omission (AC-01): remembered
 * devices has no backing data (no "remember me" trust column, no better-auth
 * config), so that row is informational-only with no button — a "Forget all"
 * that no-oped would be worse than no card at all. Session timeout IS real
 * (`SESSION_MINUTES`, imported from idle-timeout.tsx, is derived from that
 * module's SESSION_MS), so that row shows the true idle minutes. There's no
 * "Preview" button because idle-timeout.tsx exposes no callable trigger — its
 * warning state is private to the <IdleTimeout> instance mounted in
 * workspace-chrome.tsx, with no context/store/export this panel could call
 * into. Faking a trigger (e.g. a local look-alike dialog) would misrepresent
 * the real 15-minute mechanism, so it's omitted rather than simulated.
 */
export function SessionsPanel() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  // The active session's token identifies "this device" among the list.
  // `useSession()` and `listSessions()` resolve independently, so we must wait
  // for BOTH before rendering rows — otherwise, in the window where the list has
  // loaded but the current token hasn't, every row looks non-current and would
  // (wrongly) expose a revoke button for the device in use + overcount "others".
  const { data: active, isPending: sessionPending } = authClient.useSession();
  const currentToken = active?.session.token;

  const sessions = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message ?? "Couldn't load your sessions.");
      return data ?? [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });

  const revokeOne = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(error.message ?? "Couldn't sign out that device.");
    },
    onSuccess: () => {
      void invalidate();
      toast({ tone: "success", description: "Signed out that device." });
    },
    onError: (e: Error) => toast({ tone: "error", description: e.message }),
  });

  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message ?? "Couldn't sign out the other devices.");
    },
    onSuccess: () => {
      void invalidate();
      toast({ tone: "success", description: "Signed out all other devices." });
    },
    onError: (e: Error) => toast({ tone: "error", description: e.message }),
  });

  // Current device first, then most-recently-active. The current session's
  // updatedAt slides on every request (auth.ts updateAge:0), so it reads ~now.
  const rows = [...(sessions.data ?? [])].sort((a, b) => {
    if (a.token === currentToken) return -1;
    if (b.token === currentToken) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  const otherCount = rows.filter((s) => s.token !== currentToken).length;
  const busy = revokeOne.isPending || revokeOthers.isPending;
  // Gate on both loads so we never render revoke controls without knowing which
  // session is the current device.
  const loading = sessions.isPending || sessionPending;

  async function signOutDevice(token: string, label: string) {
    const ok = await confirm({
      title: "Sign out this device?",
      description: `${label} will be signed out immediately and will need to sign in again.`,
      confirmLabel: "Sign out",
      tone: "danger",
    });
    if (ok) revokeOne.mutate(token);
  }

  async function signOutOthers() {
    const ok = await confirm({
      title: "Sign out all other devices?",
      description: `${otherCount} other ${otherCount === 1 ? "session" : "sessions"} will be signed out immediately. This device stays signed in.`,
      confirmLabel: "Sign out all others",
      tone: "danger",
    });
    if (ok) revokeOthers.mutate();
  }

  return (
    <>
      <AccountPanel>
        <AccountPanelHeading
          title="Active sessions"
          description="Devices currently signed in to your account."
          action={
            otherCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[var(--error)] hover:bg-[var(--errortint)]"
                disabled={busy}
                onClick={() => void signOutOthers()}
              >
                {revokeOthers.isPending ? "Signing out…" : "Sign out others"}
              </Button>
            ) : null
          }
        />

        <div className="mt-[14px] border border-[var(--line2)]">
          {loading ? (
            <ul className="flex flex-col">
              {[0, 1].map((i) => (
                <li
                  key={i}
                  className="flex flex-col gap-2 border-b border-[var(--line2)] px-[14px] py-[11px] last:border-b-0"
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </li>
              ))}
            </ul>
          ) : sessions.isError ? (
            <p className="px-[14px] py-[11px] text-small text-[var(--error)]">
              {(sessions.error as Error).message}
            </p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((s) => {
                const isCurrent = s.token === currentToken;
                const label = deviceLabel(s.userAgent);
                return (
                  <li
                    key={s.token}
                    className="flex items-center justify-between gap-3 border-b border-[var(--line2)] px-[14px] py-[11px] last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-body font-semibold text-foreground">
                          {label}
                        </span>
                        {isCurrent ? (
                          <StatusBadge tone="success" variant="outline">
                            This device
                          </StatusBadge>
                        ) : null}
                      </div>
                      <span className="text-mono-sm text-[var(--ink3)]">
                        {[
                          browserName(s.userAgent),
                          s.ipAddress,
                          `Last active ${relativeTime(s.updatedAt)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {isCurrent ? null : (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="shrink-0 text-[var(--error)]"
                        disabled={busy}
                        onClick={() => void signOutDevice(s.token, label)}
                      >
                        Sign out
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AccountPanel>

      {/*
        Prototype lines 385-395: a second, separate bordered card below the
        sessions list (not nested inside AccountPanel's border) — honest
        hybrid per AC-01. See the file doc comment above for what's real vs.
        informational-only.
      */}
      <div
        className="mt-4 border border-[var(--line)] bg-[var(--surface)]"
        style={{ padding: "20px 22px" }}
      >
        <div className="font-heading text-title font-extrabold text-[var(--ink)]">
          Trusted devices &amp; timeout
        </div>

        <div className="mt-[14px] flex items-center justify-between gap-3 border-b border-[var(--line2)] pb-[14px]">
          <div className="min-w-0">
            <div className="text-body text-[var(--ink)]">Remembered devices</div>
            <div className="mt-0.5 text-mono-xs text-[var(--ink3)]">
              Device trust isn&apos;t enabled yet — sessions end on sign-out.
            </div>
          </div>
          {/* No "Forget all" button: there's nothing to forget — device trust
              has no backend (no remember-me column, no better-auth config) —
              so an enabled button here would no-op. */}
        </div>

        <div className="mt-[14px] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-body text-[var(--ink)]">Session timeout</div>
            <div className="mt-0.5 text-mono-xs text-[var(--ink3)]">
              You&apos;re signed out automatically after {SESSION_MINUTES} minutes idle.
            </div>
          </div>
          {/* No "Preview" button: idle-timeout.tsx exposes no callable trigger
              for its warning modal (state is private to the <IdleTimeout>
              instance in workspace-chrome.tsx) — faking one would misrepresent
              the real mechanism. */}
        </div>
      </div>
    </>
  );
}

/**
 * Browser token parsed from the user agent ("Chrome", "Safari", …), or null
 * when unrecognized. Shared by `deviceLabel()` and the session sub-line
 * (browser · IP · when — the prototype's "location" segment is dropped since
 * this app has no geolocation, only userAgent + ipAddress). Order matters:
 * Edge/Chrome UAs also contain "Safari", so check the most specific token
 * first.
 */
function browserName(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

/**
 * Light user-agent label ("Chrome on macOS") — no UA-parsing dependency.
 */
function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = browserName(ua);
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}
