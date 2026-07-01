"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { relativeTime } from "@/lib/relative-time";

const SESSIONS_KEY = ["account", "sessions"] as const;

/**
 * Devices & sessions (FR-ACCT-03). Self-service: lists the user's own active
 * sessions via better-auth's client SDK (scoped to their cookie), marks the
 * current device, and revokes others. Destructive actions confirm first
 * (FR-SYS-02). See docs/tech-plan/account-sessions — the admin force-sign-out
 * (ticket 06) is a *separate* privileged server call, not this path.
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
    <Card>
      <CardHeader>
        <CardTitle>Devices &amp; sessions</CardTitle>
        <CardDescription>
          Where you&rsquo;re signed in. Sign out any device you don&rsquo;t recognise.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <ul className="flex flex-col">
            {[0, 1].map((i) => (
              <li key={i} className="flex flex-col gap-2 border-t border-[var(--line2)] py-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </li>
            ))}
          </ul>
        ) : sessions.isError ? (
          <p className="border-t border-[var(--line2)] py-4 text-small text-[var(--error)]">
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
                  className="flex items-center justify-between gap-4 border-t border-[var(--line2)] py-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-small font-semibold text-foreground">
                        {label}
                      </span>
                      {isCurrent ? (
                        <StatusBadge tone="brand" dot>
                          This device
                        </StatusBadge>
                      ) : null}
                    </div>
                    <span className="text-mono-sm text-[var(--ink3)]">
                      {s.ipAddress ? `${s.ipAddress} · ` : ""}
                      Last active {relativeTime(s.updatedAt)}
                    </span>
                  </div>
                  {isCurrent ? null : (
                    <Button
                      variant="destructive"
                      size="sm"
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
      </CardContent>

      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading || busy || otherCount === 0}
          onClick={() => void signOutOthers()}
        >
          {revokeOthers.isPending ? "Signing out…" : "Sign out all other devices"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Light user-agent label ("Chrome on macOS") — no UA-parsing dependency.
 * Order matters: Edge/Chrome UAs also contain "Safari", Chrome UAs contain
 * "Safari" too, so check the most specific token first.
 */
function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
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
