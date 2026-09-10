"use client";

import { useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";

import { Action, Actions } from "@/components/ai-elements/actions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageAvatar, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputField,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { useNewChat } from "@/features/chat/api/chat";
import { useChatFeedback } from "@/features/chat/hooks/use-chat-feedback";
import { createChatTransport, lastTextPart } from "@/features/chat/lib/chat-transport";
import type { ChatUIMessage } from "@/features/chat/server/ui-message";

type ChatConversationProps = {
  solutionId: string;
  monogram: string | null;
  welcomeMessage?: string;
  starterPrompts?: string[];
  feedbackEnabled: boolean;
  accentColor?: string | null;
  accentColorInvert?: string | null;
};

/**
 * The interactive chat surface mounted by `ChatSlot` (ticket 12's placeholder,
 * replaced here). Owns `useChat` + the "New chat" mutation — self-contained
 * so the brand header ticket 12 already built stays untouched.
 */
export function ChatConversation({
  solutionId,
  monogram,
  welcomeMessage,
  starterPrompts,
  feedbackEnabled,
  accentColor,
  accentColorInvert,
}: ChatConversationProps) {
  const [input, setInput] = useState("");
  const requestPending = useRef(false);
  const newChat = useNewChat();
  const { votes, rate } = useChatFeedback();

  const transport = useMemo(() => createChatTransport(solutionId), [solutionId]);

  const { messages, sendMessage, regenerate, error, clearError, status, setMessages } =
    useChat<ChatUIMessage>({ transport });

  const isBusy = status === "submitted" || status === "streaming";
  const botMonogram = monogram?.trim() || "A";
  const showStarters = messages.length === 0 && (starterPrompts?.length ?? 0) > 0;

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy || error || newChat.isPending || requestPending.current) return;
    requestPending.current = true;
    setInput("");
    try {
      await sendMessage({ text: trimmed });
    } finally {
      requestPending.current = false;
    }
  };

  const retry = async () => {
    if (!error || isBusy || newChat.isPending || requestPending.current) return;
    requestPending.current = true;
    try {
      await regenerate();
    } finally {
      requestPending.current = false;
    }
  };

  const handleNewChat = () => {
    if (isBusy || newChat.isPending || requestPending.current) return;
    newChat.mutate(
      { solutionId },
      {
        onSuccess: () => {
          setMessages([]);
          clearError();
          setInput("");
        },
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          <div className="flex items-center justify-between">
            <div />
            <Button
              className="h-[26px] px-[9px] text-mono-sm"
              disabled={isBusy || newChat.isPending}
              onClick={handleNewChat}
              size="sm"
              type="button"
              variant="ghost"
            >
              ↻ New chat
            </Button>
          </div>
          <div className="self-center border border-[var(--line2)] px-[9px] py-[3px] font-mono text-mono-sm tracking-[0.06em] text-[var(--ink3)]">
            TODAY
          </div>

          {welcomeMessage?.trim() ? (
            <Message from="assistant">
              <MessageAvatar
                accentColor={accentColor}
                accentColorInvert={accentColorInvert}
                monogram={botMonogram}
              />
              <MessageContent from="assistant">{welcomeMessage}</MessageContent>
            </Message>
          ) : null}

          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <Message from="user" key={message.id}>
                  <MessageContent
                    accentColor={accentColor}
                    accentColorInvert={accentColorInvert}
                    from="user"
                  >
                    {lastTextPart(message)}
                  </MessageContent>
                </Message>
              );
            }

            const reasoningPart = message.parts.find((part) => part.type === "reasoning");
            const text = message.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("");
            const vote = votes[message.id];
            const isLast = message.id === messages.at(-1)?.id;
            const interrupted = isLast && !!error;
            const showFeedback =
              feedbackEnabled && text.length > 0 && !(isLast && isBusy) && !interrupted;

            return (
              <div className="flex flex-col gap-[5px]" key={message.id}>
                <Message from="assistant">
                  <MessageAvatar
                    accentColor={accentColor}
                    accentColorInvert={accentColorInvert}
                    monogram={botMonogram}
                  />
                  <div className="flex min-w-0 max-w-[80%] flex-col gap-2">
                    {reasoningPart ? (
                      <Reasoning isStreaming={isBusy && reasoningPart.state === "streaming"}>
                        <ReasoningTrigger>
                          {interrupted ? "Reasoning interrupted" : undefined}
                        </ReasoningTrigger>
                        <ReasoningContent>{reasoningPart.text}</ReasoningContent>
                      </Reasoning>
                    ) : null}
                    {text ? (
                      <MessageContent from="assistant">
                        <Response>{text}</Response>
                      </MessageContent>
                    ) : null}
                    {interrupted ? (
                      <p className="text-small text-[var(--error)]">Incomplete response</p>
                    ) : null}
                  </div>
                </Message>
                {showFeedback ? (
                  <Actions className="pl-[35px]">
                    <Action
                      active={vote === "up"}
                      onClick={() => rate(message.id, "up")}
                      tone="success"
                      tooltip="Helpful"
                    >
                      ▲
                    </Action>
                    <Action
                      active={vote === "down"}
                      onClick={() => rate(message.id, "down")}
                      tone="error"
                      tooltip="Not helpful"
                    >
                      ▼
                    </Action>
                  </Actions>
                ) : null}
              </div>
            );
          })}
          {error ? (
            <div
              className="flex flex-wrap items-center gap-3 border border-[var(--error)] bg-[var(--errortint)] px-3 py-2 text-small text-[var(--error)]"
              role="alert"
            >
              <p className="min-w-0 flex-1">
                We couldn’t complete the response. Retry the message or start a new chat.
              </p>
              <Button disabled={newChat.isPending} onClick={retry} size="sm" type="button">
                Retry
              </Button>
            </div>
          ) : null}
          {newChat.isError ? (
            <p className="text-small text-[var(--error)]" role="alert">
              We couldn’t start a new chat. Your messages are still here. Try New chat again.
            </p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {showStarters ? (
        <Suggestions className="shrink-0 px-[18px] pb-2">
          {starterPrompts?.map((prompt) => (
            <Suggestion key={prompt} onClick={submit} suggestion={prompt} />
          ))}
        </Suggestions>
      ) : null}

      <PromptInput
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
      >
        <PromptInputField
          disabled={isBusy || newChat.isPending}
          onChange={(event) => setInput(event.target.value)}
          value={input}
        />
        <PromptInputSubmit
          accentColor={accentColor}
          accentColorInvert={accentColorInvert}
          disabled={isBusy || !!error || newChat.isPending || !input.trim()}
          status={status}
        />
      </PromptInput>
    </div>
  );
}
