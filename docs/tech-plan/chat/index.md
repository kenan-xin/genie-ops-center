---
kind: spec
title: "Tech Plan — Chat"
---

# Tech Plan — Chat

How a **Chat** solution streams from the external Genie API through our server into the ai-sdk-ui client. Grounded in the [observed contract](../../external-chat-api-contract/index.md). Server = a Next.js Route Handler proxy; client = ai-sdk-ui `useChat` rendered with AI Elements, re-skinned to Ledger.

## Request → stream sequence

```mermaid
sequenceDiagram
  participant U as useChat (AI Elements)
  participant R as /api/chat (server)
  participant DB as Postgres
  participant G as External Genie API

  U->>R: POST { solutionId, prompt }
  R->>R: getSession + assertCanRun(user, solution)
  R->>DB: load type/config (assert type==='chat'); read solution.chatConfigVersion
  R->>R: assertAllowedEndpoint(apiEndpoint, GENIE_CHAT_API_ALLOWED_ORIGINS)
  R->>G: POST { uuid:botUuid, userPrompt:prompt, sessionUUID, language, ... }  (redirect: "manual", timeouts)
  activate G
  loop processing events
    G-->>R: data {status:processing, answer?, reasoning?, uuid:convId}
    R-->>U: reasoning-delta (if reasoning)  /  text-delta (if answer)
  end
  G-->>R: data {status:completed, answer:FULL, outputTokens}
  deactivate G
  R->>DB: upsert chat_session_handle(user,solution,convId)
  R-->>U: text-end + finish (usage)
```

## Server: SSE → ai-sdk UI message stream

Built with `createUIMessageStream({ execute({ writer }) })` + `createUIMessageStreamResponse` — **no `streamText`** (we hand-pipe; there's no LLM provider on our side).

**Request body:** `{ solutionId, prompt }`. The client's `DefaultChatTransport.prepareSendMessagesRequest` extracts `prompt` from the last submitted text part (the external API wants a plain `userPrompt`, not ai-sdk's `parts` shape).

**Per external `data:` event:**

- **`reasoning`** non-empty → emit a `reasoning` part. Open a `reasoning-start` (stable id) on first sight, then `reasoning-delta`; close `reasoning-end` when the answer starts or at `completed`. _(Observed once as a single block; if it ever streams multi-chunk, accumulate — if a new value is a prefix-superset of the prior treat as cumulative, else append.)_ **Verify the exact ai-sdk reasoning writer part types against the installed SDK types before building** — text parts are confirmed, the reasoning equivalents are not. If low-level reasoning chunks aren't supported, stream a custom `data-reasoning` part and adapt the copied `Reasoning` renderer.
- **`answer`** non-empty → open a `text-start` (stable id) on first sight, then a `text-delta` per chunk. **Each event's `answer` is a delta**, so write it as-is.
- Capture the event `uuid` (the external conversation id).

**On `status: "completed"`:** emit `text-end` (+ `reasoning-end` if open) and `finish` (carry `outputTokens`). **Do not re-emit `answer` _or_ `reasoning`** — the completed event echoes both in full, and re-emitting would duplicate the message/thinking. Then **upsert the returned `uuid` into `chat_session_handle` only if its `generation` is unchanged** (see conversation model). A contract test feeds `processing.reasoning` + `completed.reasoning` and asserts the final UI message has exactly one reasoning block and one answer. The exact manual `finish`/usage writer shape is verified in the **same SDK type spike** as the reasoning parts; if manual usage chunks aren't supported, emit a `data-usage` part and let the route finish after `text-end`.

**Invariants:**
- `assertCanRun` gates the route (Maintenance/Down/Draft never stream) — but it does **not** check type, so the route must **independently parse `config` and reject unless `type==='chat'`** (a Ready *Embedded* solution POSTed here must 400, not 500 — critique B4).
- Bot identity = `solution.config.botUuid`, read server-side.
- **Endpoint (FR-ADM-S-03):** per-solution `solution.config.apiEndpoint`; there is **no app-wide env base**. Trust model = an **ops allow-list of origins** (`GENIE_CHAT_API_ALLOWED_ORIGINS`): the endpoint's *origin* must be on the list. The proxy calls `assertAllowedEndpoint(apiEndpoint, chatAllowedOrigins())` (`src/lib/url-guard.ts`) before the fetch **and re-validates any redirect target** — set `redirect: "manual"` and reject/re-check 3xx (a followed redirect to an internal URL is the SSRF hole a naive fetch leaves open). Because the host is pre-approved we don't chase DNS-rebinding across the internet; the allow-list is the gate, the private-IP check is belt-and-suspenders. The endpoint never reaches the client.
- **Bounded fetch (critique H4):** an admin-configured endpoint can hang/tarpit. The proxy must set a connect + idle(no-data) + total-stream timeout via `AbortController`, wire `request.signal` so a client disconnect cancels the upstream, and bound event-line bytes / total answer bytes / event count. Prompt has a max length (request schema). Reject non-2xx / wrong content-type; on malformed SSE or an `errorMessage`/unexpected `status`, emit a controlled error and **do not** persist the handle.

## Conversation model — one thread + "New chat"

- One persistent external conversation per `(user, solution)`, stored as `chat_session_handle` (handle only, **no transcript**) with a **`generation`** counter. On open, resume by sending the stored `externalSessionUuid`; the route reads `generation` _before_ calling the external API and upserts the returned `uuid` **only if `generation` is unchanged** at completion.
- **"New chat"** increments `generation` (and nulls `externalSessionUuid`) in a transaction → the next message sends an empty `sessionUUID` → a fresh external conversation. Because the upsert is **generation-guarded**, a response still streaming from the old conversation **cannot resurrect** the old `uuid` after a reset (the critical race the re-critique caught). "New chat" is disabled while a stream is in flight. **Concurrent sends are serialized by a short-TTL DB in-flight lease per `(user, solution)`** — acquired before the external call, cleared in a `finally`, returning a visible "already sending" if held; _not_ a transaction held open across the SSE stream. The `generation` guard (reset safety) and the lease (send serialization) solve **different** races — both are needed. Tests cover concurrent-send and concurrent-new-chat-vs-send.
- **Resume = model-continuity, blank-but-continuable screen:** on reopen the UI shows the configured greeting (no past bubbles — we store no messages and the external API has no history GET), but the bot still carries prior context. Visible history is a later slice (needs transcript storage).
- **Config-change invalidation (critique B3):** the handle stores an external conversation id bound to a specific backend/bot. When an admin changes `apiEndpoint` or `botUuid`, `solution.chatConfigVersion` is bumped (done in `solutions.update`). The route reads `chatConfigVersion` before the external call and **persists the returned conversation id only if it's unchanged at completion** — so a stale id can't attach to the new backend, **including the case where no handle row exists yet** (a first-message stream at the old version won't persist against the new config). This is a *solution-level* version guard, distinct from the per-handle `generation` (which is the user's own "New chat" reset). **In-flight decision (H3):** an already-streaming response finishes on the old config (the user sees one last old-backend answer) but its handle is **not** persisted; we do **not** kill in-flight streams on config change. Immediate cutover is a later option (set Maintenance first, or terminate on version drift).
- **Lease storage (critique B2):** the in-flight send lease lives on `chat_session_handle` (`leaseOwner`, `leaseExpiresAt`) — acquire with an atomic conditional update where no unexpired lease exists; clear in `finally` **only if `leaseOwner` still matches**, so an old request's `finally` can't clear a newer lease after TTL takeover.

## Client: ai-sdk-ui + AI Elements (Ledger-skinned)

`useChat` owns chat state/streaming/status/stop/regenerate. UI is **AI Elements**, copied into `components/ai-elements/*`, **restyled to Ledger** (square corners, hairlines, Geist, brand-blue, mono eyebrows, 3px bubbles, paper-plane send) and **ported to Base UI** (decision): each copied component's Radix primitives are replaced with Base UI equivalents — e.g. `Reasoning`'s Radix Collapsible → Base UI Collapsible — so the app runs **one primitive system, no Radix**. Enumerate the exact per-component primitive swaps when scoping the chat tickets (some components — `Response`/Streamdown — have no Radix dependency and port for free).

| AI Elements                 | Role here                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Conversation` / `Message`  | Message list + bot/user bubbles (Ledger styling)                                                              |
| `Response` (**Streamdown**) | Renders the `answer` — **raw HTML rendering + sanitization built in** (see below)                             |
| `Reasoning`                 | The **thinking block** (see below)                                                                            |
| `PromptInput`               | The composer (Enter / send button)                                                                            |
| `Suggestions`               | Configurable **starter prompts** (FR-VIEW-01)                                                                 |
| `Actions`                   | Thumbs up/down — **ephemeral/client-only** in foundation (matches prototype toast); durable feedback deferred |

### Rendering the answer (HTML via Streamdown)

`answer` is **inline HTML** (`<strong>`, `<span style="color:#52c41a;">`), and deltas can split mid-tag/mid-attribute. Streamdown (inside `Response`) renders the raw HTML, runs its own sanitize + link-safety pipeline, and is built to render **incomplete** streaming markup — so the partial-tag problem is the renderer's job, not ours. **No separate DOMPurify pass.**

> **Updated for the installed `streamdown@2.5.0`** (verified empirically against the real package — the older `rehype-harden allowedLinkPrefixes/allowDataImages` knobs no longer exist in the public API; the config below is what shipped in ticket 14). The earlier plan text describing `rehype-harden` defaults is **superseded**.

- **Security config is explicit, not default.** Use Streamdown's documented **`urlTransform`**: links `https:`/`mailto:` only, images `https:` only (no `data:`, no wildcard). Do not override `rehypePlugins` — Streamdown's own raw→sanitize→harden + `linkSafety` layers stay intact beneath `urlTransform`.
- **No arbitrary inline `style`.** Streamdown strips `style` by default (dropping the bot's color spans) — **do not re-allow it**. Instead **map the observed color spans to Ledger `data-tone`** via a pure pre-transform (`mapColorSpansToTone` in `features/chat/lib/response-hardening.ts`) that rewrites only _complete_ `<span style="color:#hex">` into `<span data-tone="…">` (hue-bucketed into ~4 closed Ledger tones). Incomplete/mid-stream spans fall through untouched and are sanitized away. Allow only `data-tone` on `span` via `allowedTags: { span: ['dataTone'] }` (**note the camelCase key** — verified empirically; the DOM attr is still `data-tone`). Raw hex never reaches the DOM.
- **Color fallback:** if the mapping proves brittle, **strip color** explicitly — never re-allow `style`.
- **Renderer test (required, shipped):** `scripts/smoke-chat-response-security.mts` — 20 assertions: `<script>` strip, unsafe link, `http:` rejected, `https`/`mailto` allowed, `data:` image blocked, https image allowed, the observed green `<span style="color:#52c41a">` → `data-tone`, split-across-deltas mid-attribute. Runs via plain `node` (the streamdown ESM export map breaks `tsx`'s tsconfig-paths shim — a `tsx` bug, not ours).

### The thinking block (`reasoning`)

Industry-standard collapsible disclosure, rendered with AI Elements `Reasoning`, **above** the answer, only when `reasoning` is present (it's intermittent):

- **While thinking** (reasoning streaming, answer not started): auto-**expanded**, live text; header `● THINKING`, dot pulsing.
- **When the answer begins / stream ends**: auto-**collapses** to `THOUGHT FOR Ns` (mono) + `›` chevron; re-expandable. Historical messages stay collapsed.
- **Ledger styling:** 1px `--line` hairline container, square corners, no shadow, `--panel`; mono uppercase eyebrow in `--ink3`; `●` dot amber→neutral; body in muted `--ink2`, `--t-sm`, max-height + scroll. Motion ~.15–.22s, **disabled under `prefers-reduced-motion`** (NFR-A11Y-01).
- Maps to `<Reasoning isStreaming={status==='streaming'}>` → `<ReasoningTrigger>` (header) → `<ReasoningContent>` (body).

## Status, offline, presentation

- `assertCanRun` gates streaming; `Maintenance`/`Down` render a non-interactive status notice instead of the composer (FR-VIEW-05). `Draft` not openable.
- Offline indicator driven by real `online`/`offline` events (FR-VIEW-07); presentation chrome modes (sidebar/standalone/present) per FR-VIEW-06 are viewer-shell concerns, not chat-specific.

## Open items

- Verify the exact ai-sdk **reasoning writer part types** against installed SDK types (text parts confirmed; reasoning not), and whether `reasoning` ever streams multi-chunk (only seen as one block).
- External **error-event** shape (couldn't trigger one) → map to ai-sdk `onError` + a visible error state.
- Attachment path (`documentIDs`/`imageIDs`/`audioIDs`) — out of foundation; confirm upload contract before the attachments slice.
