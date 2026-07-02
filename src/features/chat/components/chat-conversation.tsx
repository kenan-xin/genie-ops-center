"use client";

import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";
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
import type { ChatUIMessage } from "@/features/chat/server/ui-message";

type ChatConversationProps = {
  solutionId: string;
  monogram: string | null;
  welcomeMessage?: string;
  starterPrompts?: string[];
  feedbackEnabled: boolean;
};

function lastTextPart(message: ChatUIMessage | undefined): string {
  if (!message) return "";
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (part.type === "text") return part.text;
  }
  return "";
}

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
}: ChatConversationProps) {
  const [input, setInput] = useState("");
  const newChat = useNewChat();
  const { votes, rate } = useChatFeedback();

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { solutionId, prompt: lastTextPart(messages.at(-1)) },
        }),
      }),
    [solutionId],
  );

  const { messages, sendMessage, status, setMessages } = useChat<ChatUIMessage>({ transport });

  const isBusy = status === "submitted" || status === "streaming";
  const botMonogram = monogram?.trim() || "A";
  const showStarters = messages.length === 0 && (starterPrompts?.length ?? 0) > 0;

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  };

  const handleNewChat = () => {
    if (isBusy || newChat.isPending) return;
    newChat.mutate({ solutionId }, { onSuccess: () => setMessages([]) });
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
              <MessageAvatar monogram={botMonogram} />
              <MessageContent from="assistant">{welcomeMessage}</MessageContent>
            </Message>
          ) : null}

          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <Message from="user" key={message.id}>
                  <MessageContent from="user">{lastTextPart(message)}</MessageContent>
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
            const showFeedback = feedbackEnabled && text.length > 0 && !(isLast && isBusy);

            return (
              <div className="flex flex-col gap-[5px]" key={message.id}>
                <Message from="assistant">
                  <MessageAvatar monogram={botMonogram} />
                  <div className="flex min-w-0 max-w-[80%] flex-col gap-2">
                    {reasoningPart ? (
                      <Reasoning isStreaming={reasoningPart.state === "streaming"}>
                        <ReasoningTrigger />
                        <ReasoningContent>{reasoningPart.text}</ReasoningContent>
                      </Reasoning>
                    ) : null}
                    {text ? (
                      <MessageContent from="assistant">
                        <Response>{text}</Response>
                      </MessageContent>
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
          submit(input);
        }}
      >
        <PromptInputField
          disabled={isBusy}
          onChange={(event) => setInput(event.target.value)}
          value={input}
        />
        <PromptInputSubmit disabled={isBusy || !input.trim()} status={status} />
      </PromptInput>
    </div>
  );
}
