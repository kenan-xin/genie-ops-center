"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/utils";

type SelectItem = { value: string; label: string };

// Ledger select built on Base UI Select. Trigger matches the input recipe with
// a pure-CSS triangle caret (no SVG data-URI). Popup is a hairline-bordered
// lifted surface; the selected item reads in brand.
//
// react-hook-form: bind via <Controller> — pass `name`, and wire
// `value`/`onValueChange` from `field.value`/`field.onChange`. `onBlur` is
// forwarded to the trigger so touched-state and `mode:"onBlur"` validation work.
function Select({
  items,
  value,
  defaultValue,
  onValueChange,
  onBlur,
  placeholder = "Select…",
  className,
  disabled,
  name,
  required,
  form,
}: {
  items: SelectItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  form?: string;
}) {
  return (
    <SelectPrimitive.Root
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as string)}
      onOpenChange={(open) => {
        if (!open) onBlur?.();
      }}
      disabled={disabled}
      name={name}
      required={required}
      form={form}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-none border border-[var(--line)] bg-[var(--surface)] px-3 font-sans text-body text-foreground outline-none transition-colors focus-visible:border-[var(--brand)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="flex">
          <span
            aria-hidden
            className="size-0 border-x-4 border-t-[5px] border-x-transparent border-t-[var(--ink3)]"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} className="z-50 outline-none">
          <SelectPrimitive.Popup className="max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-none border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-dialog)] outline-none">
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 font-sans text-body text-foreground outline-none select-none data-[highlighted]:bg-[var(--panel)] data-[selected]:text-[var(--brand)]"
              >
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="text-[var(--brand)]">
                  ✓
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
