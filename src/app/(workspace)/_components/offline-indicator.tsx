"use client";

import { useEffect } from "react";

import { useWorkspaceChromeStore } from "../_lib/chrome-store";

/**
 * FR-VIEW-07 — fixed top bar driven by real `online`/`offline` window events.
 * Writes the derived state into the chrome store; the banner itself is rendered
 * from the store so it reflects the live connection at all times. SSR-safe:
 * `navigator.onLine` is read only inside the effect.
 */
export function OfflineIndicator() {
  const offline = useWorkspaceChromeStore((s) => s.offline);
  const setOffline = useWorkspaceChromeStore((s) => s.setOffline);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOffline]);

  if (!offline) return null;

  return (
    <output
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 150,
        background: "var(--error)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        padding: "8px 14px",
        fontSize: "var(--t-sm)",
        fontWeight: 600,
        boxShadow: "0 2px 10px rgba(0,0,0,.2)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
      You&rsquo;re offline — changes may not be saved until your connection returns.
    </output>
  );
}
