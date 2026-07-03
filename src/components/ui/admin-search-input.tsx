type AdminSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * 32px bordered search composite (AP-02) — hairline border, 11×11
 * circle-outline glyph, borderless inner input. Prototype `.dc.html:652`.
 * Consumed by the People/Groups/Solutions admin toolbars.
 */
export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  ...props
}: AdminSearchInputProps) {
  return (
    <div className="flex h-8 w-[220px] max-w-[48vw] items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-[10px]">
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
