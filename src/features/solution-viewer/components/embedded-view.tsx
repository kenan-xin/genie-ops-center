"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FR-VIEW-04 — the embedded (Smart-API) experience. Renders the per-solution
 * `iframeUrl` in a sandboxed `<iframe>`, wrapped in the prototype's "browser
 * chrome" frame (dots, a read-only origin pill, reload + open-in-new-tab
 * controls). Loading and error states with retry are driven by real iframe
 * load/error events.
 *
 * Security (tech-plan → Embedded):
 *  - explicit `sandbox` — no `allow-same-origin` token handoff, no top-nav, no
 *    popups/modals. The embed is unauthenticated; there is NO SSO/token in the
 *    URL or postMessage. `allow-scripts` lets the app run; everything else is
 *    denied.
 *  - CSP `frame-src` is set app-wide from `ALLOWED_IFRAME_ORIGINS` (non-
 *    wildcard) by middleware; this component trusts the server to have already
 *    gated `iframeUrl` to an allowed origin.
 *
 * Reload is implemented by bumping a `nonce` query param on the iframe `src` so
 * the browser re-fetches without mutating history; the key also forces React to
 * remount the element, clearing any half-loaded state.
 */
export function EmbeddedView({
  iframeUrl,
  allowFullscreen,
}: {
  iframeUrl: string;
  allowFullscreen?: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the iframe hasn't fired `onLoad` within a few seconds, surface the error
  // state — a hung embed (DNS, refused, CSP-blocked) would otherwise sit on the
  // spinner forever. Cleared on a successful load or unmount.
  useEffect(() => {
    if (state !== "loading") return;
    loadTimer.current = setTimeout(() => setState("error"), 6000);
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, [state, reloadNonce]);

  const reload = useCallback(() => {
    setState("loading");
    setReloadNonce((n) => n + 1);
  }, []);

  // Build the reload URL without clobbering any existing query string. Appending
  // a cache-busting param is the most reliable cross-origin reload signal.
  // Defensive: a malformed legacy `iframeUrl` must fail into the error state,
  // not throw during render (the resolver + schema now reject such rows, but
  // this guards any that slipped in earlier).
  const src = (() => {
    try {
      const u = new URL(iframeUrl);
      u.searchParams.set("_reload", String(reloadNonce));
      return u.toString();
    } catch {
      return null;
    }
  })();

  return (
    <div style={{ padding: "20px 24px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Browser-chrome frame (prototype lines 593–598). */}
        <div
          style={{
            height: 40,
            flexShrink: 0,
            borderBottom: "1px solid var(--line)",
            background: "var(--panel)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 12px",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--line)" }}
            />
            <span
              style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--line)" }}
            />
            <span
              style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--line)" }}
            />
          </div>
          <div
            style={{
              flex: 1,
              height: 24,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              font: "500 var(--m-md) var(--font-mono)",
              color: "var(--ink3)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {(() => {
              try {
                return new URL(iframeUrl).host;
              } catch {
                return iframeUrl;
              }
            })()}
          </div>
          <button
            type="button"
            title="Reload"
            onClick={reload}
            style={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--ink2)",
              border: "1px solid var(--line)",
              background: "transparent",
            }}
          >
            ↻
          </button>
          <a
            href={iframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            style={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--ink2)",
              border: "1px solid var(--line)",
              background: "transparent",
              textDecoration: "none",
            }}
          >
            ↗
          </a>
        </div>

        {/* Iframe host — overlays for loading/error sit above the iframe. */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {state === "loading" ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface)",
              }}
            >
              <div className="csSpin" style={spinnerStyle} />
              <div
                style={{
                  font: "500 var(--m-md) var(--font-mono)",
                  color: "var(--ink3)",
                  marginTop: 14,
                  letterSpacing: "0.06em",
                }}
              >
                LOADING EMBEDDED APP…
              </div>
            </div>
          ) : null}
          {state === "error" || src === null ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface)",
                padding: 24,
                textAlign: "center",
              }}
            >
              <div style={{ width: 30, height: 3, background: "var(--error)" }} />
              <div
                style={{
                  font: "600 var(--m-sm) var(--font-mono)",
                  letterSpacing: "0.12em",
                  color: "var(--error)",
                  marginTop: 14,
                }}
              >
                ● FAILED TO LOAD
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "var(--t-h3)",
                  color: "var(--ink)",
                  marginTop: 7,
                  letterSpacing: "-0.01em",
                }}
              >
                This solution didn&rsquo;t load
              </div>
              <div
                style={{
                  fontSize: "var(--t-sm)",
                  color: "var(--ink2)",
                  marginTop: 7,
                  lineHeight: 1.55,
                  maxWidth: 340,
                }}
              >
                The embedded app couldn&rsquo;t be reached. This is usually temporary — check your
                connection and try again.
              </div>
              <button
                type="button"
                onClick={reload}
                style={{
                  marginTop: 16,
                  height: 38,
                  padding: "0 18px",
                  background: "var(--brand)",
                  color: "#fff",
                  border: "none",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 700,
                  fontSize: "var(--t-body)",
                  cursor: "pointer",
                }}
              >
                ↻ Retry
              </button>
            </div>
          ) : null}
          {state !== "error" && src !== null ? (
            <iframe
              key={reloadNonce}
              src={src}
              title="Embedded solution"
              onLoad={() => setState("loaded")}
              // No allow-popups/allow-popups-to-escape-sandbox: an embed must not
              // be able to window.open() into an unsandboxed top-level tab. No
              // allow-same-origin either (no token/SSO handoff). Scripts+forms only.
              sandbox="allow-scripts allow-forms"
              allow={allowFullscreen ? "fullscreen" : undefined}
              referrerPolicy="no-referrer"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
                background: "var(--surface)",
                // Keep the iframe beneath the overlays until loaded.
                visibility: state === "loaded" ? "visible" : "hidden",
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

const spinnerStyle = {
  width: 38,
  height: 38,
  border: "3px solid var(--line)",
  borderTopColor: "var(--brand)",
  borderRadius: "50%",
} as const;
