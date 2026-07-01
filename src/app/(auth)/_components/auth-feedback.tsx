// Shared inline feedback primitives for the auth forms. Hairline-boxed, tinted
// per tone — neutral copy, customer-safe (NFR-CONTENT-01).

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
      className="border border-[var(--error)] bg-[var(--errortint)] px-3 py-2 text-small text-[var(--error)]"
    >
      {message}
    </div>
  );
}

/** Success / info banner (e.g. "password reset" notice returned to sign-in). */
export function NoticeBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="border border-[var(--success)] bg-[var(--successtint)] px-3 py-2 text-small text-[var(--success)]">
      {message}
    </div>
  );
}
