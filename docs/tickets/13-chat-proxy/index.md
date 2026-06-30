---
kind: ticket
title: "13 · Chat streaming proxy"
status: 0
---

# 13 · Chat streaming proxy

The `/api/chat` Route Handler that proxies the external Genie SSE into an ai-sdk UI message stream. Server-side only.

## Scope — in

- **Route**: POST `{ solutionId, prompt }`; `getSession` + **`assertCanRun`**; load `solution.config.botUuid`; lookup `chat_session_handle` (read its `generation`).
- **External call**: POST the contract body `{ uuid: botUuid, userPrompt: prompt, sessionUUID, language, ... }` to `EXTERNAL_CHAT_API_BASE` (server env; never client).
- **Stream mapping** (per the [contract](../../external-chat-api-contract/index.md)): emit `text` parts for `processing.answer` deltas; `reasoning` parts for `reasoning`; on `completed` emit `text-end`/`reasoning-end`/`finish` (usage) and **ignore the echoed full `answer`/`reasoning`**. Build with `createUIMessageStream` + `createUIMessageStreamResponse` (no `streamText`).
- **Conversation handle**: upsert the returned conversation `uuid` **only if `generation` is unchanged**; **"New chat"** bumps `generation` + nulls `externalSessionUuid` in a txn.
- **Send serialization**: a short-TTL DB in-flight **lease** per `(user, solution)` (acquire before the external call, clear in `finally`, return "already sending" if held) — _not_ a transaction held across the stream.

## Scope — out

- The chat UI/rendering (ticket 14). Transcript persistence, attachments, feedback storage (deferred).

## Governs

[chat](../../tech-plan/chat/index.md), [external-chat-api-contract](../../external-chat-api-contract/index.md), [data-model](../../tech-plan/data-model/index.md) (`chat_session_handle`).

## Depends on

[03 · Identity + schema + migrations](../03-identity-schema-migrations/index.md), [08 · Admin: Solutions](../08-admin-solutions/index.md) (botUuid config), [12 · Viewer shell](../12-solution-viewer-embedded/index.md).

## Acceptance / guardrails (critique invariants)

- **SDK type spike first**: verify the exact ai-sdk `reasoning` and `finish`/usage writer part types against installed types; fall back to `data-reasoning` / `data-usage` if unsupported.
- Tests: one-block assembly (`processing`+`completed` reasoning → one block); **generation-guard** (old stream completing after "New chat" cannot resurrect the old handle); **concurrent-send** and **concurrent-new-chat-vs-send** (lease holds).
- External base/secret never reach the client; `assertCanRun` blocks Maintenance/Down/Draft from streaming.
