"use client";

import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = { value: T; label: string };

// Ledger segmented control: bordered row, active segment = --ink fill / white,
// dividers are a left hairline. Brand stays reserved for primary/selection
// elsewhere — the segmented active uses ink, per the style guide.
function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      data-slot="segmented"
      role="tablist"
      aria-disabled={disabled}
      className={cn(
        "inline-flex rounded-none border border-[var(--line)] font-sans text-small font-semibold",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "px-3 py-2 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed",
              index > 0 && "border-l border-[var(--line)]",
              active
                ? "bg-[var(--ink)] text-[var(--on-ink)]"
                : "bg-transparent text-[var(--ink2)] hover:bg-[var(--panel)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
