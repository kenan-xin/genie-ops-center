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

const IDLE_MS = 15 * 60 * 1000; // 15 min of inactivity before the warning (FR-AUTH-04)
const COUNTDOWN_S = 60; // grace period inside the modal
const ACTIVITY = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

/**
 * Client idle watcher for authenticated surfaces. After 15 min without activity
 * it opens a modal counting down 60s. "Stay signed in" pings get-session — an
 * authed request, which slides the sliding 15-min server expiry forward
 * (auth.ts: updateAge 0) — and re-arms. Reaching zero or "Sign out" clears
 * transient state and returns to sign-in (FR-AUTH-05). Motion is the kit
 * dialog's, already reduced-motion-safe via the global reset.
 */
export function IdleTimeout() {
  const router = useRouter();
  const { data: session, refetch } = authClient.useSession();
  const hasSession = Boolean(session);

  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_S);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const onActivity = () => armIdle();
    for (const e of ACTIVITY) window.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of ACTIVITY) window.removeEventListener(e, onActivity);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [hasSession, warning, armIdle]);

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
