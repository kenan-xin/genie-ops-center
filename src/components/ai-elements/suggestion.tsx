"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AI Elements `Suggestions`/`Suggestion`, ported for free — no Radix
 * dependency upstream either way. Deviation: the prototype wraps starter
 * chips onto multiple lines (`flex-wrap`) rather than AI Elements' default
 * horizontal-scroll `ScrollArea`; matched the prototype instead of importing
 * a scroll-area primitive nothing else here needs.
 */

export type SuggestionsProps = ComponentProps<"div">;

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
    {children}
  </div>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "ghost",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => (
  <Button
    className={cn("h-auto rounded-[3px] px-[11px] py-[7px] text-small font-normal", className)}
    onClick={() => onClick?.(suggestion)}
    size={size}
    type="button"
    variant={variant}
    {...props}
  >
    {children || suggestion}
  </Button>
);
