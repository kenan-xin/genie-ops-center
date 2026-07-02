"use client";

import { useMemo, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented";

import { fontStack, type ThemeConfig } from "../schemas/theme";

type Device = "desktop" | "mobile";

const DEVICE_WIDTH: Record<Device, number> = { desktop: 380, mobile: 300 };
const PREVIEW_HEIGHT = 560;

/**
 * Chat-only preview (FR-ADM-T-03), proto 953-957 & 1008. Rendered inside a
 * sandboxed, script-less iframe (`sandbox=""`) so the admin's Custom-CSS tab
 * is genuinely scoped to the chat surface — the browser's own document
 * boundary keeps it from leaking into the admin chrome, no CSS-scoping
 * library needed. The device frame uses `max-width` (not a fixed `width`) so
 * it shrinks to fit a narrow container instead of overflowing it — pair with
 * `min-w-0` on the flex/grid cell that hosts this component.
 */
export function ThemePreview({ config }: { config: ThemeConfig }) {
  const [device, setDevice] = useState<Device>("desktop");
  const srcDoc = useMemo(() => buildPreviewHtml(config), [config]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-mono-sm font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase">
          Live preview
        </span>
        <SegmentedControl
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: "Mobile" },
          ]}
          value={device}
          onValueChange={setDevice}
        />
      </div>
      <div className="flex justify-center border border-[var(--line)] bg-[var(--panel)] p-5">
        <div
          className="w-full overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-dialog)] transition-[max-width] duration-200"
          style={{ maxWidth: DEVICE_WIDTH[device], height: PREVIEW_HEIGHT }}
        >
          <iframe
            title="Chat theme preview"
            srcDoc={srcDoc}
            sandbox=""
            className="size-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPreviewHtml(config: ThemeConfig): string {
  const inputRadius = Math.min(config.radius, 18);
  // Custom CSS is user-authored — neutralize a stray `</style>` so it can't
  // break out of the style block; `sandbox=""` already blocks any script
  // execution regardless.
  const customCss = config.customCss.replace(/<\/style/gi, "&lt;/style");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; font-family: ${fontStack(config.font)}; background: #f2f4f7; }
  .chat { display: flex; flex-direction: column; height: 100%; }
  .header { background: ${config.headerColor}; color: #fff; padding: 14px 16px; font-weight: 700; font-size: 14px; }
  .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .bubble { max-width: 78%; padding: 10px 14px; font-size: 14px; line-height: 1.4; border-radius: ${config.radius}px; }
  .bubble.assistant { align-self: flex-start; background: #fff; border: 1px solid #e2e5ea; color: #14161b; }
  .bubble.user { align-self: flex-end; background: ${config.bubbleColor}; color: #fff; }
  .composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e2e5ea; background: #fff; }
  .composer input { flex: 1; min-width: 0; border: 1px solid #c8cdd5; border-radius: ${inputRadius}px; padding: 8px 12px; font-size: 14px; font-family: inherit; }
  .composer button { border: none; background: ${config.headerColor}; color: #fff; border-radius: ${inputRadius}px; padding: 8px 14px; font-size: 13px; font-weight: 600; }
  ${customCss}
</style>
</head>
<body>
  <div class="chat">
    <div class="header">Assistant</div>
    <div class="messages">
      <div class="bubble assistant">Hi! How can I help you today?</div>
      <div class="bubble user">I have a question about my order.</div>
      <div class="bubble assistant">Sure — what would you like to know?</div>
    </div>
    <div class="composer">
      <input placeholder="${escapeHtml(config.placeholder)}" disabled />
      <button type="button">Send</button>
    </div>
  </div>
</body>
</html>`;
}
