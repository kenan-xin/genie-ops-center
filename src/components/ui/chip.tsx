import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Ledger chip — mixed-case SANS (not mono), 1px hairline border, 2px radius,
// surface fill. For tags like group names and people-reached counts. Distinct
// from StatusBadge (mono uppercase on a semantic tint) — do not swap them.
const chipVariants = cva(
  "inline-flex max-w-full items-center rounded-[2px] border border-[var(--line)] bg-[var(--surface)] px-[7px] py-[2px] font-sans text-small font-medium text-[var(--ink)]",
  {
    variants: {
      tone: {
        neutral: "border-[var(--line)] text-[var(--ink)]",
        brand: "border-[var(--brand)] bg-[var(--brandtint)] text-[var(--brandink)]",
      },
      truncate: {
        true: "overflow-hidden text-ellipsis whitespace-nowrap",
        false: "",
      },
    },
    defaultVariants: {
      tone: "neutral",
      truncate: false,
    },
  },
);

function Chip({
  className,
  tone,
  truncate,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return (
    <span data-slot="chip" className={cn(chipVariants({ tone, truncate }), className)} {...props}>
      {children}
    </span>
  );
}

export { Chip, chipVariants };
