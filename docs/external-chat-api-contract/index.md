---
kind: spec
title: "External Genie Chat API — Observed Contract"
---

# External Genie Chat API — Observed Contract

Captured by calling `POST https://dev-genie.001.gs/public-api/v2/workflow/chatbot/chats` directly (2026-06-30). This is a dated observation, not a fresh verification of the external service or its production authentication policy. The implemented bridge is in `src/features/chat/server/`. Where this conflicts with the prototype's canned-reply behavior, **this wins**.

## Transport

- **SSE** — `content-type: text/event-stream`, HTTP/2. `cache-control: no-cache`.
- Each event is a single `data: {json}\n\n` line. **No `event:` types, no `[DONE]` sentinel.**
- **Termination signal = `status: "completed"`** (or an error event — see lifecycle). Stream closes after.
- No auth header was required — the endpoint accepted that request at capture time. (Production should still proxy server-side; see invariants.)

## Request

```json
{
  "uuid": "f48f6cbd-ef08-4d9d-a7c5-89494ba5ab68",
  "userPrompt": "…user message…",
  "sessionUUID": "",
  "language": "en-US",
  "documentIDs": [],
  "imageIDs": [],
  "audioIDs": [],
  "customFields": {}
}
```

| Field                                   | Meaning (observed)                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`                                  | **The chatbot / workflow id** — _which bot_ to talk to. Stable per bot; stored in each Chat solution's config. (The tested bot is a fixed hospital-ops workflow that returns intent-driven answers, not a free LLM.) |
| `sessionUUID`                           | **The conversation id.** Empty `""` → server starts a new conversation. Pass back the returned `uuid` to continue the same conversation.                                                                             |
| `userPrompt`                            | The user's message text.                                                                                                                                                                                             |
| `language`                              | BCP-47 (`en-US`).                                                                                                                                                                                                    |
| `documentIDs` / `imageIDs` / `audioIDs` | Attachment id arrays (empty in foundation).                                                                                                                                                                          |
| `customFields`                          | Free-form object.                                                                                                                                                                                                    |

## Response event envelope

Every `data:` event has the same keys:

| Field                                             | Notes                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`                                            | **Conversation id.** Same across all events of one response; identical on the continuation call → confirms it's the session handle.                                                                                                                               |
| `requestMessageID` / `responseMessageID`          | Per-message ids.                                                                                                                                                                                                                                                  |
| `status`                                          | Lifecycle: `initiating` → `processing` → `completed`.                                                                                                                                                                                                             |
| `answer`                                          | **The streamed text** — see framing below (the load-bearing detail).                                                                                                                                                                                              |
| `reasoning`                                       | **Optional** — the bot's _thinking_, streamed separately from `answer`. Absent in many responses; when present, arrives before/alongside the answer and is echoed in full on `completed`. Maps to ai-sdk reasoning parts / the AI Elements `Reasoning` component. |
| `inputTokens` / `outputTokens` / `TokenBreakdown` | Usage; populated at `completed` (`0` earlier).                                                                                                                                                                                                                    |
| `nodeInfos`                                       | Verbose workflow execution trace (root → start → logic → … nodes, with per-node logs/timings). Not needed for chat text; could drive a "thinking/steps" indicator.                                                                                                |
| `title`                                           | Conversation title (derived from first prompt).                                                                                                                                                                                                                   |
| `intents`                                         | Intent routing object.                                                                                                                                                                                                                                            |
| `errorMessage`                                    | Empty on success.                                                                                                                                                                                                                                                 |
| `startTime` / `endTime`                           | RFC3339; `endTime` is zero-value until done.                                                                                                                                                                                                                      |

## ⚠️ `answer` framing — the load-bearing detail

- During **`processing`**, each event's `answer` is an **incremental DELTA** (the next chunk of new text only — it does _not_ repeat earlier text).
- The **`completed`** event's `answer` is the **ENTIRE final text** (the concatenation of all deltas).
- Verified: deltas of length `101 + 73 + 92 + 61 + 78 + 109 = 514` and the `completed` `answer` was exactly **514** chars.

**Mapping rule:** stream the `processing` deltas as text; on `completed`, **do not append `answer` again** — it's the full text. Treat `completed` as end-of-stream + source of token usage (and an authoritative full-text reconciliation if needed).

- `answer` contains **inline HTML** (`<strong>`, `<span style="color:#52c41a;">`, `\n`), not plain text — and a delta can split mid-tag _and mid-attribute_ (observed: one delta ends `…<span style="color: #52c41a`, the next begins `;">`). The prototype's plain-text assumption does not hold.
- **Current renderer:** `src/components/ai-elements/response.tsx` uses Streamdown with the app's explicit hardening in `src/features/chat/lib/response-hardening.ts`. It allows absolute `https:`/`mailto:` links and absolute `https:` images; relative URLs and other protocols are rejected.
- **Inline styles stay stripped.** `mapColorSpansToTone` rewrites recognized complete color spans into the closed Ledger `data-tone` set (`success`, `warn`, `error`, `neutral`) before rendering. Incomplete or unrecognized spans fall through to the renderer's sanitizer. Do not enable arbitrary `style` attributes.

## `reasoning` — the "thinking" block

- It's the bot's **thinking**, rendered as a _separate_ block from `answer` (the reply shown to the user). Industry-standard pattern: a collapsible "Thinking…" disclosure that's expanded + live while the model reasons, then auto-collapses to a "Thought for Ns" summary when the answer begins, manually re-expandable. The **AI Elements `Reasoning` component** does exactly this — Ledger-styled (mono `THINKING` eyebrow, hairline, muted text).
- **Intermittent:** present in some responses (the `"dfdf"` run), absent in others (a "recommend a fix" run produced none). Don't assume it's always there.
- When present here it arrived as a **single block** in one `processing` event _before_ the `answer` stream began; `completed` repeated the full text. Whether it ever streams as multiple deltas in longer runs is **unconfirmed** — handle generically (accumulate; if a new value is a prefix-superset of the prior, treat as cumulative, else append).

## Status lifecycle

```mermaid
flowchart LR
  I["initiating<br/>answer=''"] --> P["processing<br/>answer = delta chunk<br/>(repeats N times)"]
  P --> P
  P --> C["completed<br/>answer = FULL text<br/>+ token usage"]
  P -.error.-> E["error event<br/>errorMessage set<br/>(unverified shape)"]
```

## ai-sdk-ui bridge (high level — detail belongs in tech-plan)

A Next.js route handler proxies this SSE server-side and re-emits the **ai-sdk UI message stream**: for each `data:` JSON → emit a **`text-delta`** for the `processing` `answer` and a **`reasoning`** delta for any `reasoning`; on `completed` emit `finish` (carry `outputTokens`) and **do not** re-emit the full `answer`. Server holds the bot `uuid` (from solution config) and looks up `sessionUUID` from the user-and-solution-scoped server handle (start empty, persist the returned conversation id for follow-ups). The client renders the answer with **AI Elements `Response` (Streamdown)** — HTML rendering plus the explicit application hardening above — and the thinking with the **AI Elements `Reasoning`** block.

## Implemented behavior and remaining contract uncertainty

The upstream conversation UUID is stored server-side in `chat_session_handle`, scoped to the user and solution; it is not accepted from the browser. The browser transcript is in memory. The app does not persist or fetch transcript history. New Chat clears the server handle and local messages.

The mapper ignores the repeated final `answer`, closes text/reasoning parts and emits SDK `finish` metadata with `outputTokens`. Populated `errorMessage`, malformed events, unknown statuses and EOF before `completed` fail the request. The UI exposes a safe error and retry, labels interrupted replies incomplete and detects a client stream ending without SDK `finish`.

The original capture did not establish the full upstream error schema, multi-delta reasoning behavior, production authentication requirements or provider rate limits. Attachments and `nodeInfos` UI are not implemented. Revalidate those external details against the intended upstream service when adding them; current work status belongs in Beads.
