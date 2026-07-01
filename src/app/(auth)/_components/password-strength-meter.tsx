"use client";

import { strength, strengthMeta, type StrengthTone } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const BAR: Record<StrengthTone, string> = {
  weak: "bg-[var(--error)]",
  fair: "bg-[var(--warn)]",
  good: "bg-[var(--success)]",
};
const TEXT: Record<StrengthTone, string> = {
  weak: "text-[var(--error)]",
  fair: "text-[var(--warn)]",
  good: "text-[var(--success)]",
};

// Live UX meter — the gate itself is the shared zod schema (server + form),
// this only visualizes it. Transition obeys the global reduced-motion reset.
export function PasswordStrengthMeter({ value }: { value: string }) {
  const score = value ? strength(value) : 0;
  const { label, tone } = strengthMeta(score);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((seg) => (
          <span
            key={seg}
            className={cn(
              "h-1 flex-1 rounded-none transition-colors duration-150",
              seg <= score ? BAR[tone] : "bg-[var(--line2)]",
            )}
          />
        ))}
      </div>
      <span
        aria-live="polite"
        className={cn(
          "font-mono text-mono-xs font-semibold uppercase tracking-[0.1em]",
          value ? TEXT[tone] : "text-[var(--ink3)]",
        )}
      >
        {value ? `Strength: ${label}` : "Use 3 of: length, upper, lower, digit, symbol"}
      </span>
    </div>
  );
}
