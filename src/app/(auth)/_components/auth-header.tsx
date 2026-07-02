// Shared auth-card header: Geist title at the card-head scale (not the page
// --t-display) + optional description. `badge` is for real status/role states
// only (e.g. the admin "● ADMINISTRATOR" chip) — most screens pass none.
export function AuthHeader({
  badge,
  title,
  description,
}: {
  badge?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-3">
      {badge ? (
        <span className="inline-flex w-fit items-center gap-[7px] bg-[var(--ink)] px-[9px] py-1 font-mono text-mono-sm font-semibold uppercase tracking-[0.12em] text-[var(--on-ink)]">
          <span aria-hidden>●</span>
          {badge}
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-sans text-cardhead font-extrabold tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-body leading-[1.5] text-[var(--ink2)]">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
