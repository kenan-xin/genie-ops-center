import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Ledger buttons: square corners, Hanken Grotesk, type via the --t-* scale (never px/rem
// — this resolves ticket 01's carry-forward). Brand fill is reserved for
// `primary`; press = colour shift only (no shrink).
const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-none font-sans text-small outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary font-bold text-primary-foreground hover:brightness-[0.94]",
        dark: "bg-[var(--ink)] font-bold text-[var(--on-ink)] hover:brightness-[0.94]",
        ghost:
          "border border-[var(--line)] bg-transparent font-semibold text-foreground hover:bg-[var(--panel)]",
        destructive:
          "border border-[var(--line)] bg-transparent font-semibold text-[var(--error)] hover:bg-[var(--errortint)]",
        link: "bg-transparent font-semibold text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px]",
        sm: "h-8 px-3",
        auth: "h-11 px-[18px] text-title",
        icon: "size-10",
      },
    },
    compoundVariants: [
      // Text link is inline: no fixed height or horizontal padding.
      { variant: "link", class: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
