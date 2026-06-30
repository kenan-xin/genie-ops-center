/* eslint-disable jsx-a11y/label-has-associated-control -- reusable eyebrow label primitive; callers associate it with a control via `htmlFor` (forwarded through ...props) */
import { cn } from "@/lib/utils";

// Mono uppercase eyebrow label — the Ledger field/section label.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "block font-mono text-mono-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink2)]",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
