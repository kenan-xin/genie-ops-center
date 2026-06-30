"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

// The Toggle — the ONLY pill in the system. 38×22 track, 18px knob,
// brand when on, hairline-grey when off.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-[var(--radius-pill)] bg-[var(--line)] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring data-[checked]:bg-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="absolute left-[2px] size-[18px] rounded-full bg-white shadow-sm transition-transform duration-150 group-data-[checked]:translate-x-[16px]" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
