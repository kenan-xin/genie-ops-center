"use client";

import { memo } from "react";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown, type StreamdownProps } from "streamdown";

import { VegaLiteRenderer } from "@/features/chat/components/vega-lite-renderer";
import { cn } from "@/lib/utils";
import {
  CHAT_ALLOWED_TAGS,
  chatUrlTransform,
  mapColorSpansToTone,
} from "@/features/chat/lib/response-hardening";

export type ResponseProps = Omit<StreamdownProps, "allowedTags" | "urlTransform" | "children"> & {
  children: string;
};

const STREAMDOWN_PLUGINS = {
  mermaid,
  renderers: [
    {
      component: VegaLiteRenderer,
      language: ["vega-lite", "vegalite"],
    },
  ],
} satisfies NonNullable<StreamdownProps["plugins"]>;

/**
 * AI Elements `Response`, ported for free — Streamdown has no Radix
 * dependency. The external Genie `answer` is untrusted inline HTML (see
 * external-chat-api-contract), so `allowedTags`/`urlTransform` here are the
 * explicit hardening boundary (response-hardening.ts); never widen these to
 * allow raw `style` or extra protocols.
 */
export const Response = memo(
  ({
    className,
    children,
    codeBlockMaxHeight = 0,
    tableMaxHeight = 0,
    ...props
  }: ResponseProps) => (
    <Streamdown
      allowedTags={CHAT_ALLOWED_TAGS}
      className={cn(
        "w-full min-w-0 text-body leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      codeBlockMaxHeight={codeBlockMaxHeight}
      plugins={STREAMDOWN_PLUGINS}
      tableMaxHeight={tableMaxHeight}
      urlTransform={chatUrlTransform}
      {...props}
    >
      {mapColorSpansToTone(children)}
    </Streamdown>
  ),
);

Response.displayName = "Response";
