import { cn } from "@/lib/utils";

import { ICON_TILE } from "./control-size";

// Square hairline icon button for table row action lanes.
//
// Hover shifts the border and the ink, NOT the fill. A fill hover cannot work
// here: TableRow already hovers to --panel, so a --panel button fill on a
// hovered row is invisible, and --brandtint/--errortint differ from --panel by
// about 1%. The border carries the state instead, so it reads on --surface and
// on a hovered row alike.
const TONE_CLASSES = {
  default: "text-[var(--ink2)] enabled:hover:border-[var(--ink)] enabled:hover:text-[var(--ink)]",
  brand: "text-[var(--brandink)] enabled:hover:border-[var(--brandink)]",
  error: "text-[var(--error)] enabled:hover:border-[var(--error)]",
} as const;

export type IconButtonTone = keyof typeof TONE_CLASSES;

export function IconButton({
  label,
  tone = "default",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type" | "title" | "aria-label"> & {
  label: string;
  tone?: IconButtonTone;
}) {
  return (
    <button
      type="button"
      data-slot="icon-button"
      title={label}
      aria-label={label}
      className={cn(
        ICON_TILE,
        "flex shrink-0 items-center justify-center border border-[var(--line)] bg-transparent outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
