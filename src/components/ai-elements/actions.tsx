"use client";

import type { ComponentProps } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * AI Elements `Actions`/`Action`, ported to Base UI. Radix→Base-UI swap:
 * shadcn's `Tooltip` (`@radix-ui/react-tooltip`) → `@base-ui/react/tooltip`;
 * `Button` was already Radix-free upstream. Scoped to the feedback row
 * (below a bot bubble) — no app-wide `TooltipProvider` needed for this.
 */

export type ActionsProps = ComponentProps<"div">;

export const Actions = ({ className, children, ...props }: ActionsProps) => (
  <TooltipProvider>
    <div className={cn("flex items-center gap-1", className)} {...props}>
      {children}
    </div>
  </TooltipProvider>
);

export type ActionProps = ComponentProps<typeof TooltipTrigger> & {
  tooltip: string;
  active?: boolean;
  tone?: "success" | "error";
};

const TONE_COLOR: Record<NonNullable<ActionProps["tone"]>, string> = {
  success: "text-[var(--success)]",
  error: "text-[var(--error)]",
};

export const Action = ({ tooltip, active, tone, className, children, ...props }: ActionProps) => (
  <Tooltip>
    <TooltipTrigger
      className={cn(
        "flex size-6 cursor-pointer items-center justify-center border border-[var(--line2)] text-small text-[var(--ink3)] outline-none transition-colors duration-150 hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring",
        active && tone && TONE_COLOR[tone],
        className,
      )}
      {...props}
    >
      {children}
      <span className="sr-only">{tooltip}</span>
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);
