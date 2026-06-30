"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

const SlideOver = DialogPrimitive.Root;
const SlideOverTrigger = DialogPrimitive.Trigger;
const SlideOverClose = DialogPrimitive.Close;

// Right-edge slide-over (record editing). Translates in from the right with the
// side shadow; square corners, hairline left border.
function SlideOverContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[rgba(8,10,14,0.45)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex justify-end">
        <DialogPrimitive.Popup
          data-slot="slide-over-content"
          className={cn(
            "relative flex h-full w-full max-w-[420px] flex-col border-l border-[var(--line)] bg-[var(--surface)] text-foreground shadow-[var(--shadow-side)] transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

function SlideOverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slide-over-header"
      className={cn("flex flex-col gap-1 border-b border-[var(--line2)] p-5", className)}
      {...props}
    />
  );
}

function SlideOverTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="slide-over-title"
      className={cn("font-sans text-cardhead font-extrabold tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

function SlideOverBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slide-over-body"
      className={cn("flex-1 overflow-y-auto p-5", className)}
      {...props}
    />
  );
}

function SlideOverFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slide-over-footer"
      className={cn(
        "flex items-center justify-end gap-2 border-t border-[var(--line2)] p-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  SlideOver,
  SlideOverTrigger,
  SlideOverClose,
  SlideOverContent,
  SlideOverHeader,
  SlideOverTitle,
  SlideOverBody,
  SlideOverFooter,
};
