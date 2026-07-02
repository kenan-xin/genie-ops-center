"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { createContext, memo, useContext, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { Response } from "./response";

/**
 * AI Elements `Reasoning`, ported to Base UI. Radix→Base-UI swap:
 * shadcn's `Collapsible` (`@radix-ui/react-collapsible`) → `@base-ui/react/
 * collapsible`; `@radix-ui/react-use-controllable-state` dropped — `isOpen`
 * is owned locally (Reasoning always drives its own open/auto-collapse
 * state here, so no external-control need justified the extra dependency).
 */

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  duration: number | undefined;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoning() {
  const ctx = useContext(ReasoningContext);
  if (!ctx) throw new Error("Reasoning components must be used within Reasoning");
  return ctx;
}

export type ReasoningProps = Omit<CollapsiblePrimitive.Root.Props, "onOpenChange"> & {
  isStreaming?: boolean;
};

const AUTO_CLOSE_DELAY_MS = 1_000;
const MS_PER_S = 1_000;

/**
 * Expanded + live while `isStreaming`; auto-collapses ~1s after streaming
 * ends (once) to "THOUGHT FOR Ns"; manually re-expandable after that via the
 * trigger. Duration is wall-clock (streaming start → end), not server-
 * reported — matches the AI Elements convention and the tech-plan.
 */
export const Reasoning = memo(
  ({ className, isStreaming = false, children, ...props }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useState(isStreaming);
    const [duration, setDuration] = useState<number | undefined>(undefined);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    useEffect(() => {
      if (isStreaming) {
        setStartTime((prev) => prev ?? Date.now());
      } else if (startTime !== null) {
        setDuration(Math.max(1, Math.round((Date.now() - startTime) / MS_PER_S)));
        setStartTime(null);
      }
    }, [isStreaming, startTime]);

    useEffect(() => {
      if (isStreaming && !isOpen) {
        setIsOpen(true);
      } else if (!isStreaming && isOpen && !hasAutoClosed) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY_MS);
        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, hasAutoClosed]);

    const contextValue = useMemo(
      () => ({ isStreaming, isOpen, duration }),
      [isStreaming, isOpen, duration],
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <CollapsiblePrimitive.Root
          className={cn("not-prose", className)}
          onOpenChange={setIsOpen}
          open={isOpen}
          {...props}
        >
          {children}
        </CollapsiblePrimitive.Root>
      </ReasoningContext.Provider>
    );
  },
);
Reasoning.displayName = "Reasoning";

export type ReasoningTriggerProps = CollapsiblePrimitive.Trigger.Props;

/** `● THINKING` while live; `THOUGHT FOR Ns ›` once collapsed. */
export const ReasoningTrigger = memo(({ className, children, ...props }: ReasoningTriggerProps) => {
  const { isStreaming, isOpen, duration } = useReasoning();

  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 border border-[var(--line)] bg-[var(--panel)] px-3 py-2 font-mono text-mono-sm font-semibold tracking-[0.08em] text-[var(--ink3)] uppercase outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span
            aria-hidden
            className={cn(
              "inline-block",
              isStreaming ? "text-[var(--warn)] motion-safe:animate-pulse" : "text-[var(--ink3)]",
            )}
          >
            ●
          </span>
          <span className="flex-1 text-left">
            {isStreaming || duration === undefined ? "THINKING" : `THOUGHT FOR ${duration}S`}
          </span>
          <span
            aria-hidden
            className={cn(
              "inline-block transition-transform duration-150",
              isOpen ? "rotate-90" : "rotate-0",
            )}
          >
            ›
          </span>
        </>
      )}
    </CollapsiblePrimitive.Trigger>
  );
});
ReasoningTrigger.displayName = "ReasoningTrigger";

export type ReasoningContentProps = Omit<CollapsiblePrimitive.Panel.Props, "children"> & {
  children: string;
};

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => (
  <CollapsiblePrimitive.Panel
    className={cn(
      "h-[var(--collapsible-panel-height)] overflow-hidden border border-t-0 border-[var(--line)] bg-[var(--panel)] transition-[height] duration-200 ease-[var(--ease)] data-[ending-style]:h-0 data-[starting-style]:h-0",
      className,
    )}
    {...props}
  >
    <div className="max-h-48 overflow-y-auto px-3 py-2 text-mono-sm text-[var(--ink2)]">
      <Response>{children}</Response>
    </div>
  </CollapsiblePrimitive.Panel>
));
ReasoningContent.displayName = "ReasoningContent";
