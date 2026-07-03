"use client";

import { ChatConversation } from "@/features/chat/components/chat-conversation";

/**
 * The chat shell slot (FR-VIEW). Ticket 12 built the frame + header (kept
 * as-is below, matching the prototype); ticket 14 replaces the placeholder
 * body with the real ai-sdk-ui `useChat` + AI Elements surface, fed by the
 * `/api/chat` Route Handler (ticket 13).
 *
 * `welcomeMessage`/`starterPrompts`/`feedbackEnabled` are the client-safe
 * chat config fields (apiEndpoint/botUuid never reach here). The chat route
 * re-derives identity server-side from the solution id, so nothing sensitive
 * is pre-rendered.
 */
export function ChatSlot({
  solutionId,
  name,
  monogram,
  welcomeMessage,
  starterPrompts,
  feedbackEnabled,
  accentColor,
  accentColorInvert,
}: {
  solutionId: string;
  name: string;
  monogram: string | null;
  welcomeMessage?: string;
  starterPrompts?: string[];
  feedbackEnabled: boolean;
  accentColor?: string | null;
  accentColorInvert?: string | null;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
          borderRight: "1px solid var(--line)",
          minHeight: 0,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "13px 18px",
            borderBottom: "1px solid var(--line)",
            background: accentColor ?? "var(--brand)",
            color: accentColorInvert ?? "#fff",
            display: "flex",
            alignItems: "center",
            gap: 11,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              background: "rgba(255,255,255,.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "var(--t-title)",
            }}
          >
            {monogram?.trim() || "A"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "var(--t-title)",
              }}
            >
              {name}
            </div>
            <div style={{ font: "500 var(--m-sm) var(--font-mono)", opacity: 0.85 }}>
              ● ONLINE · SAMPLE DATA
            </div>
          </div>
        </div>
        <ChatConversation
          accentColor={accentColor}
          accentColorInvert={accentColorInvert}
          feedbackEnabled={feedbackEnabled}
          monogram={monogram}
          solutionId={solutionId}
          starterPrompts={starterPrompts}
          welcomeMessage={welcomeMessage}
        />
      </div>
    </div>
  );
}
