// Shared auth-card header: mono eyebrow + Geist display title + optional note.
// Type flows entirely through Ledger tokens (never a hard-coded px size).
export function AuthHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <span className="font-mono text-mono-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink3)]">
        {eyebrow}
      </span>
      <h1 className="m-0 font-sans text-display font-extrabold tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      {description ? <p className="text-small text-[var(--ink2)]">{description}</p> : null}
    </header>
  );
}
