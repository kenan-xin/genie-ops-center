import { cn } from "@/lib/utils";

// Ledger textarea: same recipe as Input (hairline border, square, body type)
// but multi-line with a fixed min height.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full resize-y rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-mono-sm text-foreground placeholder:text-[var(--ink3)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
