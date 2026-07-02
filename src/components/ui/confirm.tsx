"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { createContext, useCallback, useContext, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders a filled error confirm button (destructive actions). */
  tone?: "danger" | "default";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * The single shared danger-confirm (FR-SYS-02). Mount once near the root;
 * any component calls `const confirm = useConfirm(); if (await confirm({...}))`.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmProvider>");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // If a confirm is already open, settle it as `false` first so the previous
    // caller's Promise doesn't strand when we overwrite its resolver.
    resolverRef.current?.(false);
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const danger = options?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={open}
        onOpenChange={(next) => {
          // Dismiss (escape / backdrop) resolves as "cancel".
          if (!next) settle(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-[rgba(8,10,14,0.45)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <AlertDialog.Popup className="relative w-full max-w-[420px] rounded-none border border-[var(--line)] bg-[var(--surface)] text-foreground shadow-[var(--shadow-dialog)] transition-all duration-200 data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0">
              <div className="flex flex-col gap-2 p-5 pb-4">
                <AlertDialog.Title className="font-sans text-cardhead font-extrabold tracking-[-0.01em]">
                  {options?.title}
                </AlertDialog.Title>
                {options?.description ? (
                  <AlertDialog.Description className="text-small leading-relaxed text-[var(--ink2)]">
                    {options.description}
                  </AlertDialog.Description>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--line2)] p-4">
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="h-[38px] rounded-none border border-[var(--line)] bg-transparent px-4 font-sans text-small font-semibold text-foreground outline-none transition-colors hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {options?.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => settle(true)}
                  className={cn(
                    "h-[38px] rounded-none px-[18px] font-sans text-small font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    danger
                      ? "bg-[var(--error)] text-white hover:opacity-90"
                      : "bg-primary text-primary-foreground hover:opacity-90",
                  )}
                >
                  {options?.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}
