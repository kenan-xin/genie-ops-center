import { cn } from "@/lib/utils";

// Shimmer skeleton bar (on --line2). animate-pulse is opacity-based and is
// disabled under prefers-reduced-motion via the global reset.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("h-3 animate-pulse rounded-none bg-[var(--line2)]", className)}
      {...props}
    />
  );
}

// Rotating ring spinner. <output> carries an implicit role="status" live region.
function Spinner({ className, ...props }: React.ComponentProps<"output">) {
  return (
    <output
      data-slot="spinner"
      aria-label="Loading"
      className={cn(
        "block size-[18px] animate-spin rounded-full border-2 border-[var(--line2)] border-t-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton, Spinner };
