// Shared inline form-feedback primitives. Hairline-boxed, tinted per tone —
// neutral copy, customer-safe (NFR-CONTENT-01). Used by the auth forms and the
// account settings forms, so they live in components/ui, not a route group.

/** Field-level error under an input. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-small text-[var(--error)]">{message}</p>;
}

/** Form-level error banner (failed submit). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-[7px] border border-[var(--error)] bg-[var(--errortint)] px-[10px] py-2 text-small text-[var(--error)]"
    >
      <span aria-hidden className="font-heading font-extrabold leading-none">
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

/** Success / info banner (e.g. "password reset" notice returned to sign-in). */
export function NoticeBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 border border-[var(--success)] bg-[var(--successtint)] px-[11px] py-[9px] text-small text-[var(--success)]">
      <span aria-hidden className="font-heading font-extrabold leading-none">
        ✓
      </span>
      <span>{message}</span>
    </div>
  );
}
