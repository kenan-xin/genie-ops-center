import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * AI Elements `Message`/`MessageAvatar`, ported for free — the original
 * shadcn `Avatar` (`@radix-ui/react-avatar`) exists to manage image-load-
 * with-fallback state, which this app never needs: a bot identity here is
 * always a Ledger monogram box (see the prototype's chat header/bubbles),
 * never a loaded image. `MessageAvatar` is a plain styled `<div>` — no
 * primitive, Radix or Base UI, is involved.
 */

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "flex w-full items-end gap-[9px]",
      from === "user" ? "justify-end" : "justify-start",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const MessageContent = ({ className, from, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "max-w-[80%] rounded-[3px] px-[13px] py-[10px] text-body leading-normal",
      from === "user"
        ? "max-w-[78%] bg-primary text-primary-foreground"
        : "bg-[var(--panel)] text-foreground",
      className,
    )}
    {...props}
  />
);

export type MessageAvatarProps = ComponentProps<"div"> & {
  monogram: string;
};

export const MessageAvatar = ({ monogram, className, ...props }: MessageAvatarProps) => (
  <div
    className={cn(
      "flex size-[26px] shrink-0 items-center justify-center bg-primary font-sans text-[10px] font-extrabold text-primary-foreground",
      className,
    )}
    {...props}
  >
    {monogram}
  </div>
);
