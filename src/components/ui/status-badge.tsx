import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Ledger status badge: mono uppercase, semantic colour on its tint, square.
// Live/critical states lead with a ● dot (READY, MAINTENANCE, DOWN, PENDING).
const badgeVariants = cva(
  "inline-flex items-center rounded-none px-[7px] py-[3px] font-mono text-mono-xs font-semibold uppercase tracking-[0.06em]",
  {
    variants: {
      tone: {
        success: "bg-[var(--successtint)] text-[var(--success)]",
        warn: "bg-[var(--warntint)] text-[var(--warn)]",
        error: "bg-[var(--errortint)] text-[var(--error)]",
        neutral: "bg-[var(--panel)] text-[var(--ink3)]",
        brand: "bg-[var(--brandtint)] text-[var(--brand)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

function StatusBadge({
  className,
  tone,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span data-slot="status-badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden>●</span> : null}
      {children}
    </span>
  );
}

export { StatusBadge, badgeVariants };
