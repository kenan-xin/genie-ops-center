// Scaffolding placeholder for skeleton routes. Type is driven entirely by
// Ledger tokens (mono eyebrow + Archivo display), never hard-coded px.
export function Placeholder({
  eyebrow,
  title,
  note,
}: {
  eyebrow: string;
  title: string;
  note?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <span
        style={{
          font: "600 var(--m-sm) var(--font-mono)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        {eyebrow}
      </span>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--t-display)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        {title}
      </h1>
      {note ? <p style={{ maxWidth: "60ch", color: "var(--ink2)" }}>{note}</p> : null}
    </section>
  );
}
