import { cn } from "@/lib/utils";

// Ledger input: 40px default, hairline border, square, 12px padding, body type.
// `inputSize="auth"` → 42px / --t-title for the auth surface (prototype AU-01).
// Focus ring is the shared form-control rule in globals.css.
type InputSize = "default" | "auth";

function Input({
  className,
  inputSize = "default",
  ...props
}: React.ComponentProps<"input"> & { inputSize?: InputSize }) {
  return (
    <input
      data-slot="input"
      className={cn(
        "w-full rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 font-sans text-foreground placeholder:text-[var(--ink3)] disabled:cursor-not-allowed disabled:opacity-50",
        inputSize === "auth" ? "h-[42px] text-title" : "h-10 text-body",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
