"use client";

import type { ChatStatus } from "ai";
import type { ComponentProps, FormHTMLAttributes, KeyboardEventHandler } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * AI Elements `PromptInput`, ported for free — no Radix dependency upstream
 * (native `<form>`/`<input>`/`<button>`). Deviation: the prototype's composer
 * is a single-line input (not AI Elements' multi-line auto-grow textarea) —
 * matched the prototype. Attach ("+") is out of scope (attachments deferred).
 */

export type PromptInputProps = FormHTMLAttributes<HTMLFormElement>;

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      "flex shrink-0 items-center gap-[10px] border-t border-[var(--line)] bg-[var(--surface)] p-4",
      className,
    )}
    {...props}
  />
);

export type PromptInputFieldProps = ComponentProps<typeof Input>;

export const PromptInputField = ({ className, onKeyDown, ...props }: PromptInputFieldProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
    onKeyDown?.(e);
  };

  return (
    <Input
      className={cn("h-9 flex-1 font-sans", className)}
      onKeyDown={handleKeyDown}
      placeholder="Message…"
      {...props}
    />
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
  accentColor?: string | null;
  accentColorInvert?: string | null;
};

const isBusy = (status: ChatStatus | undefined) => status === "streaming" || status === "submitted";

/** Cancel-in-flight isn't in scope — busy is a disabled, non-interactive state. */
export const PromptInputSubmit = ({
  className,
  status,
  accentColor,
  accentColorInvert,
  style,
  ...props
}: PromptInputSubmitProps) => (
  <Button
    aria-label="Send"
    className={cn("size-9 shrink-0 p-0", className)}
    size="icon"
    style={
      accentColor
        ? { background: accentColor, color: accentColorInvert ?? "var(--onbrand)", ...style }
        : style
    }
    type="submit"
    variant="primary"
    {...props}
  >
    {isBusy(status) ? (
      <span aria-hidden className="size-[9px] rounded-full bg-current motion-safe:animate-pulse" />
    ) : (
      <svg
        aria-hidden
        fill="none"
        height="17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="17"
      >
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22 11 13 2 9 22 2Z" />
      </svg>
    )}
  </Button>
);
