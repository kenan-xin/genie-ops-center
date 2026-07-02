"use client";

/**
 * The chat shell slot (FR-VIEW). Ticket 12 provides ONLY the mount point — the
 * ai-sdk-ui `useChat` client + AI Elements surface lands in ticket 14, fed by
 * the `/api/chat` Route Handler (ticket 13). For a ready chat solution we
 * render the configured welcome message (or a neutral placeholder) centered in
 * the same column the chat will occupy, so the layout is stable when 14 mounts.
 *
 * `welcomeMessage`/`starterPrompts` are the client-safe chat config fields
 * (apiEndpoint/botUuid never reach here). The chat route re-derives identity
 * server-side from the solution id, so nothing sensitive is pre-rendered.
 */
export function ChatSlot({ name, welcomeMessage }: { name: string; welcomeMessage?: string }) {
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
            background: "var(--brand)",
            color: "#fff",
          }}
        >
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
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            color: "var(--ink3)",
            fontSize: "var(--t-body)",
          }}
        >
          {welcomeMessage?.trim()
            ? welcomeMessage
            : "Chat loads here — the conversation client mounts in a later ticket."}
        </div>
      </div>
    </div>
  );
}
