import { cn } from "@/lib/utils";

// Ledger empty state: dashed square keyline tile + glyph, Archivo title,
// muted body, optional CTA.
function EmptyState({
  className,
  glyph = "∅",
  title,
  description,
  action,
  ...props
}: React.ComponentProps<"div"> & {
  glyph?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 border border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="flex size-[42px] items-center justify-center border-[1.5px] border-dashed border-[var(--line)] font-sans font-extrabold text-[var(--ink3)]"
      >
        {glyph}
      </div>
      <div className="font-sans text-title font-bold">{title}</div>
      {description ? (
        <div className="max-w-[42ch] text-small text-[var(--ink2)]">{description}</div>
      ) : null}
      {action}
    </div>
  );
}

export { EmptyState };
