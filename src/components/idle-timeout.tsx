"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";

const SESSION_MS = 15 * 60 * 1000; // server sliding session lifetime (auth.ts expiresIn)
const COUNTDOWN_S = 60; // grace period inside the modal
// Warn BEFORE the server would expire, so the "Stay signed in" refetch still
// lands inside the valid window and actually slides the session forward — if we
// warned AT expiry, the refresh could arrive too late to refresh anything.
const IDLE_MS = SESSION_MS - COUNTDOWN_S * 1000;
// Throttle: an active user who only moves the mouse makes no authed request, so
// the server session would silently expire. Slide it on activity, at most this
// often, to keep an active session alive without hammering the endpoint.
const KEEPALIVE_MS = SESSION_MS / 2;
const ACTIVITY = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

/**
 * Client idle watcher for authenticated surfaces. Opens a warning modal 60s
 * before the 15-min server session would lapse, counting down 60s. Activity
 * re-arms the timer and (throttled) slides the server session; "Stay signed in"
 * refetches get-session — an authed request that slides the sliding expiry
 * (auth.ts: updateAge 0). Reaching zero or "Sign out" clears state and returns
 * to sign-in (FR-AUTH-04/05). Motion is the kit dialog's, reduced-motion-safe.
 */
export function IdleTimeout() {
  const router = useRouter();
  const { data: session, refetch } = authClient.useSession();
  const hasSession = Boolean(session);

  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_S);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPing = useRef(0);

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setWarning(true), IDLE_MS);
  }, []);

  const signOut = useCallback(async () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setWarning(false);
    await authClient.signOut();
    router.replace("/login?notice=signed-out");
  }, [router]);

  const staySignedIn = useCallback(async () => {
    setWarning(false);
    await refetch();
  }, [refetch]);

  // Arm the idle timer and watch for activity — only while signed in and not
  // already warning (the countdown owns the warning phase).
  useEffect(() => {
    if (!hasSession || warning) return;
    armIdle();
    const onActivity = () => {
      armIdle();
      // Throttled keepalive: slide the SERVER session on activity so an active
      // user (moving the mouse but not navigating) isn't silently expired.
      const now = Date.now();
      if (now - lastPing.current > KEEPALIVE_MS) {
        lastPing.current = now;
        void refetch();
      }
    };
    for (const e of ACTIVITY) window.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of ACTIVITY) window.removeEventListener(e, onActivity);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [hasSession, warning, armIdle, refetch]);

  // Tick the countdown while the warning is open; sign out at zero.
  useEffect(() => {
    if (!warning) return;
    setRemaining(COUNTDOWN_S);
    const tick = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(tick);
          void signOut();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [warning, signOut]);

  if (!hasSession) return null;

  return (
    <Dialog
      open={warning}
      onOpenChange={(open) => {
        if (!open) void staySignedIn();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            You&rsquo;ll be signed out in {remaining}s to keep your account secure.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button onClick={() => void staySignedIn()}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
