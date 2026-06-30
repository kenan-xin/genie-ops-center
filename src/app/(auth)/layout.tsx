// Centered auth card shell — single column, sized by the Ledger --auth-w token.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full"
        style={{
          maxWidth: "var(--auth-w)",
          padding: "var(--auth-pad)",
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
