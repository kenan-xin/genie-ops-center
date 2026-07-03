---
kind: ticket
title: "14 · Chat UI (AI Elements → Base UI)"
status: 2
---

# 14 · Chat UI (AI Elements → Base UI)

The chat interface: ai-sdk-ui `useChat` + AI Elements, **ported to Base UI** and re-skinned to Ledger (FR-VIEW-01/02).

## Scope — in

- **`useChat`** wired to `/api/chat`; `DefaultChatTransport.prepareSendMessagesRequest` sends `{ solutionId, prompt }` (prompt = last text part).
- **AI Elements ported to Base UI** (no Radix): copy + restyle `Conversation`, `Message`, `Response`, `PromptInput`, `Suggestions`, `Actions`, `Reasoning`; replace each Radix primitive with its Base UI equivalent (e.g. `Reasoning`'s Collapsible). Enumerate the per-component swaps as the first step.
- **Answer rendering via `Response`/Streamdown**: opens with configurable greeting + starter prompts (`Suggestions`); messages stream; Ledger bubbles (bot `--panel`, user `--brand`, 3px, 26px avatar).
- **Reasoning thinking-block**: collapsible `Reasoning` — expanded+live while thinking, auto-collapses to `THOUGHT FOR Ns` when the answer starts; Ledger-styled; reduced-motion safe.
- **Message feedback** (FR-VIEW-02): thumbs up/down under bot replies (ephemeral/client), down-vote "thanks" toast, re-tap clears.
- **"New chat"** control (calls the proxy's generation bump); disabled while streaming.

## Scope — out

- The proxy/streaming backend (ticket 13). Durable feedback/transcripts, attachments (deferred).

## Governs

[chat](../../tech-plan/chat/index.md) (UI section), [external-chat-api-contract](../../external-chat-api-contract/index.md).

## Depends on

[13 · Chat streaming proxy](../13-chat-proxy/index.md), [02 · Ledger component kit](../02-ledger-component-kit/index.md).

## Acceptance / guardrails (critique invariants)

- **Streamdown security is explicit, not default**: `rehype-harden` set to https/mailto links only, `allowDataImages:false`, no wildcard protocols; **no arbitrary inline `style`** — pipeline `rehype-raw` → known-color→Ledger-class transform → `rehype-sanitize` (only those class/`data-*` attrs on `span`) → `rehype-harden`; else strip color. **Renderer test**: split-across-deltas tags, `<script>`, unsafe link, `data:` image, the observed green `<span>` → safe + Ledger-correct.
- The reasoning block renders exactly once (no duplicate from the `completed` echo) — paired with ticket 13's assembly test.
