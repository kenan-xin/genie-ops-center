import { cn } from "@/lib/utils";

import { CONTROL_HEIGHTS, type ControlSize } from "./control-size";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: ControlSize;
  className?: string;
  "aria-label"?: string;
};

/**
 * Bordered search composite — hairline border, circle-outline glyph, borderless
 * inner input. Height comes from the shared control scale (default 40px). Width
 * defaults to 220px but is overridable via `className`. Consumed by the
 * People / Groups admin toolbars and the workspace solutions hub.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  size = "md",
  className,
  ...props
}: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex w-[220px] max-w-[48vw] items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-[10px]",
        CONTROL_HEIGHTS[size],
        className,
      )}
    >
      <span
        aria-hidden
        className="size-[11px] shrink-0 rounded-full border-[1.5px] border-[var(--ink3)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-none bg-transparent font-sans text-small text-foreground outline-none placeholder:text-[var(--ink3)]"
        {...props}
      />
    </div>
  );
}
