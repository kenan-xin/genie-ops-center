import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Ledger status badge: mono uppercase, semantic colour on its tint, square.
// Live/critical states lead with a ● dot (READY, MAINTENANCE, DOWN, PENDING).
// `variant="outline"` (prototype .dc.html:379, "THIS DEVICE") is a hairline
// tone-coloured border on a transparent fill — a distinct visual family from
// the default filled-tint `solid` pill.
const badgeVariants = cva(
  "inline-flex items-center rounded-none font-mono text-mono-xs font-semibold uppercase tracking-[0.06em]",
  {
    variants: {
      tone: {
        success: "",
        warn: "",
        error: "",
        neutral: "",
        brand: "",
      },
      variant: {
        solid: "px-[7px] py-[3px]",
        outline: "border bg-transparent px-[5px] py-[2px]",
      },
    },
    compoundVariants: [
      // solid = filled tint (existing look, byte-identical to pre-variant classes)
      { tone: "success", variant: "solid", class: "bg-[var(--successtint)] text-[var(--success)]" },
      { tone: "warn", variant: "solid", class: "bg-[var(--warntint)] text-[var(--warn)]" },
      { tone: "error", variant: "solid", class: "bg-[var(--errortint)] text-[var(--error)]" },
      { tone: "neutral", variant: "solid", class: "bg-[var(--panel)] text-[var(--ink3)]" },
      { tone: "brand", variant: "solid", class: "bg-[var(--brandtint)] text-[var(--brand)]" },
      // outline = hairline border in tone colour, transparent fill
      {
        tone: "success",
        variant: "outline",
        class: "border-[var(--success)] text-[var(--success)]",
      },
      { tone: "warn", variant: "outline", class: "border-[var(--warn)] text-[var(--warn)]" },
      { tone: "error", variant: "outline", class: "border-[var(--error)] text-[var(--error)]" },
      { tone: "neutral", variant: "outline", class: "border-[var(--line)] text-[var(--ink3)]" },
      { tone: "brand", variant: "outline", class: "border-[var(--brand)] text-[var(--brand)]" },
    ],
    defaultVariants: {
      tone: "neutral",
      variant: "solid",
    },
  },
);

function StatusBadge({
  className,
  tone,
  variant,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="status-badge"
      className={cn(badgeVariants({ tone, variant }), className)}
      {...props}
    >
      {dot ? <span aria-hidden>●</span> : null}
      {children}
    </span>
  );
}

export { StatusBadge, badgeVariants };
