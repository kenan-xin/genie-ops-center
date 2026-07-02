"use client";

import { Toast } from "@base-ui/react/toast";
import { useCallback } from "react";

type ToastTone = "success" | "error" | "info";
type ToastData = { tone: ToastTone };

const TONE_BAR: Record<ToastTone, string> = {
  success: "bg-[var(--success)]",
  error: "bg-[var(--error)]",
  info: "bg-[var(--brand)]",
};

const TONE_MARK: Record<ToastTone, string> = {
  success: "✓",
  error: "!",
  info: "●",
};

const TONE_TEXT: Record<ToastTone, string> = {
  success: "text-[var(--success)]",
  error: "text-[var(--error)]",
  info: "text-[var(--brand)]",
};

function ToastViewport() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 outline-none">
        {toasts.map((toast) => {
          const tone = (toast.data as ToastData | undefined)?.tone ?? "success";
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              className="flex items-stretch overflow-hidden rounded-none border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-toast)] transition-all duration-200 data-[ending-style]:translate-y-[6px] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-[6px] data-[starting-style]:opacity-0"
            >
              <div className={`w-1 shrink-0 ${TONE_BAR[tone]}`} />
              <div className="flex flex-1 items-start gap-2 p-3">
                <span
                  aria-hidden
                  className={`font-sans text-small font-extrabold ${TONE_TEXT[tone]}`}
                >
                  {TONE_MARK[tone]}
                </span>
                <div className="flex-1">
                  {toast.title ? (
                    <Toast.Title className="font-sans text-small font-semibold text-foreground" />
                  ) : null}
                  <Toast.Description className="font-sans text-small text-foreground" />
                </div>
                <Toast.Close
                  aria-label="Dismiss"
                  className="cursor-pointer text-[var(--ink3)] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ✕
                </Toast.Close>
              </div>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

/** Mount once near the root; toasts auto-dismiss at ~4s and can be closed. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={4000}>
      {children}
      <ToastViewport />
    </Toast.Provider>
  );
}

/** `const { toast } = useToast(); toast({ tone: "success", description: "Saved." })` */
export function useToast() {
  const manager = Toast.useToastManager();
  const toast = useCallback(
    (options: { tone?: ToastTone; title?: string; description: string }) =>
      manager.add<ToastData>({
        title: options.title,
        description: options.description,
        data: { tone: options.tone ?? "success" },
      }),
    [manager],
  );
  return { toast };
}
