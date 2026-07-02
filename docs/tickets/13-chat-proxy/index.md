---
kind: ticket
title: "13 · Chat streaming proxy"
status: 0
---

# 13 · Chat streaming proxy

The `/api/chat` Route Handler that proxies the external Genie SSE into an ai-sdk UI message stream. Server-side only.

## Scope — in

- **Route**: POST `{ solutionId, prompt }` (prompt has a max length in the request schema); `getSession` + **`assertCanRun`**; load the solution, **parse `config` and reject unless `type==='chat'`** (assertCanRun doesn't check type — B4); read `botUuid` + `apiEndpoint` + **`solution.chatConfigVersion`**; lookup `chat_session_handle` (read its `generation`).
- **External call**: POST the contract body `{ uuid: botUuid, userPrompt: prompt, sessionUUID, language, ... }` to **`solution.config.apiEndpoint`** (per-solution, FR-ADM-S-03). Before the fetch, **re-run the origin gate** `assertAllowedEndpoint(apiEndpoint, chatAllowedOrigins())` (`src/lib/url-guard.ts`) — origin must be on `GENIE_CHAT_API_ALLOWED_ORIGINS`. Use **`redirect: "manual"`** and re-validate any 3xx `Location` against the same allow-list (a followed redirect to an internal URL is the residual SSRF hole). Bound the fetch: connect + idle(no-data) + total-stream `AbortController` timeouts, wire `request.signal` (client disconnect cancels upstream), cap event-line bytes / total answer bytes / event count; reject non-2xx / wrong content-type.
- **Stream mapping** (per the [contract](../../external-chat-api-contract/index.md)): emit `text` parts for `processing.answer` deltas; `reasoning` parts for `reasoning`; on `completed` emit `text-end`/`reasoning-end`/`finish` (usage) and **ignore the echoed full `answer`/`reasoning`**. Build with `createUIMessageStream` + `createUIMessageStreamResponse` (no `streamText`).
- **Conversation handle**: upsert the returned conversation `uuid` **only if BOTH `chat_session_handle.generation` AND `solution.chatConfigVersion` are unchanged** at completion; **"New chat"** bumps `generation` + nulls `externalSessionUuid` in a txn. The `chatConfigVersion` guard (bumped by `solutions.update` on endpoint/bot change — already implemented) covers the no-handle-row-yet case: a first-message stream at the old version won't persist against changed config (B3).
- **Send serialization**: a short-TTL DB in-flight **lease** per `(user, solution)` on the new `chat_session_handle.leaseOwner`/`leaseExpiresAt` columns — acquire via atomic conditional update where no unexpired lease exists, clear in `finally` **only if `leaseOwner` matches** (so an old `finally` can't clear a newer lease after TTL takeover), return "already sending" if held; _not_ a transaction held across the stream.

## Scope — out

- The chat UI/rendering (ticket 14). Transcript persistence, attachments, feedback storage (deferred).

## Governs

[chat](../../tech-plan/chat/index.md), [external-chat-api-contract](../../external-chat-api-contract/index.md), [data-model](../../tech-plan/data-model/index.md) (`chat_session_handle`).

## Depends on

[03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md) (incl. the `chat_session_handle.leaseOwner`/`leaseExpiresAt` + `solution.chatConfigVersion` columns added by migration `0001`), [08 · Admin: Solutions](../08-admin-solutions/index.md) (botUuid + apiEndpoint config), [12 · Viewer shell](../12-solution-viewer-embedded/index.md).

## Acceptance / guardrails (critique invariants)

- **SDK type spike first**: verify the exact ai-sdk `reasoning` and `finish`/usage writer part types against installed types; fall back to `data-reasoning` / `data-usage` if unsupported.
- Tests: one-block assembly (`processing`+`completed` reasoning → one block); **generation-guard** (old stream completing after "New chat" cannot resurrect the old handle); **concurrent-send** and **concurrent-new-chat-vs-send** (lease holds).
- External endpoint never reaches the client; `assertCanRun` blocks Maintenance/Down/Draft, and the route **also** rejects non-chat solutions (type/config parse) with a controlled 400/404.
- **Endpoint trust = ops allow-list:** the streaming endpoint is `solution.config.apiEndpoint` (no app-wide env base). Its origin must be on `GENIE_CHAT_API_ALLOWED_ORIGINS`, enforced at **both** the write boundary (ticket 08, done) and the proxy fetch, with `redirect: "manual"` + redirect-target re-validation.
- **Bounded upstream:** connect/idle/total timeouts + `request.signal` propagation + byte/event caps; a hung or malformed endpoint can't pin a response. Map unexpected `status`/`errorMessage` to a controlled error; never persist the handle on error.
- Tests: **SSRF** (IPv4-mapped-IPv6, redirect-to-internal, off-allow-list origin rejected); **type-guard** (Embedded solution → 400, not 500); **config-version guard** (endpoint change mid-stream, incl. no-handle-row-yet, doesn't persist stale id); lease **expired-takeover** + "old finally doesn't clear new lease"; plus the existing one-block-assembly + generation-guard + concurrent-send tests.
