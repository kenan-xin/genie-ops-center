"use client";

import { memo } from "react";
import { Streamdown, type StreamdownProps } from "streamdown";

import { cn } from "@/lib/utils";
import {
  CHAT_ALLOWED_TAGS,
  chatUrlTransform,
  mapColorSpansToTone,
} from "@/features/chat/lib/response-hardening";

export type ResponseProps = Omit<StreamdownProps, "allowedTags" | "urlTransform" | "children"> & {
  children: string;
};

/**
 * AI Elements `Response`, ported for free — Streamdown has no Radix
 * dependency. The external Genie `answer` is untrusted inline HTML (see
 * external-chat-api-contract), so `allowedTags`/`urlTransform` here are the
 * explicit hardening boundary (response-hardening.ts); never widen these to
 * allow raw `style` or extra protocols.
 */
export const Response = memo(({ className, children, ...props }: ResponseProps) => (
  <Streamdown
    allowedTags={CHAT_ALLOWED_TAGS}
    className={cn(
      "size-full text-body leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      className,
    )}
    urlTransform={chatUrlTransform}
    {...props}
  >
    {mapColorSpansToTone(children)}
  </Streamdown>
));

Response.displayName = "Response";
