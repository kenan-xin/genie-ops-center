// Centered auth-card shell (prototype "AUTH" block, lines 112-118, 185) — a
// G-tile + GENIE wordmark sit above every card, a SOC 2 caption below. The
// card itself is sized by the Ledger --auth-w/--auth-pad tokens.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="auth-page flex min-h-dvh items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex w-full flex-col items-center" style={{ maxWidth: "var(--auth-w)" }}>
        <div className="mb-[22px] flex items-center justify-center gap-[10px]">
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              background: "var(--ink)",
              color: "var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "var(--t-h3)",
            }}
          >
            G
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--t-title)",
              letterSpacing: "0.01em",
              color: "var(--ink)",
            }}
          >
            GENIE
          </span>
        </div>
        <div
          className="w-full"
          style={{
            padding: "var(--auth-pad)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
          }}
        >
          {children}
        </div>
        <footer
          className="mt-6"
          style={{
            font: "600 var(--m-sm) var(--font-mono)",
            letterSpacing: "0.12em",
            color: "var(--ink3)",
          }}
        >
          SOC 2 TYPE II
        </footer>
      </div>
    </div>
  );
}
