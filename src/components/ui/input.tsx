import { cn } from "@/lib/utils";

// Ledger input: 40px, hairline border, square, 12px padding, body type.
// Focus ring is the shared form-control rule in globals.css.
function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 font-sans text-body text-foreground placeholder:text-[var(--ink3)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
