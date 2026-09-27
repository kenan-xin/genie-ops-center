import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/features/chat/server/ui-message";

const { chat, newChat } = vi.hoisted(() => ({
  chat: {
    messages: [] as ChatUIMessage[],
    status: "ready",
    error: undefined as Error | undefined,
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    clearError: vi.fn(),
    setMessages: vi.fn(),
  },
  newChat: { isPending: false, isError: false, mutate: vi.fn() },
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));
vi.mock("@/features/chat/api/chat", () => ({ useNewChat: () => newChat }));
vi.mock("@/features/chat/hooks/use-chat-feedback", () => ({
  useChatFeedback: () => ({ votes: {}, rate: vi.fn() }),
}));

import { ChatConversation } from "./chat-conversation";

function render() {
  return renderToStaticMarkup(
    createElement(ChatConversation, {
      solutionId: "solution",
      monogram: "G",
      feedbackEnabled: true,
    }),
  );
}

beforeEach(() => {
  chat.messages = [{ id: "question", role: "user", parts: [{ type: "text", text: "Hello" }] }];
  chat.status = "ready";
  chat.error = undefined;
  newChat.isPending = false;
  newChat.isError = false;
});

describe("chat error feedback", () => {
  it("shows a safe alert and retry without rendering server errors", () => {
    chat.status = "error";
    chat.error = new Error("private upstream address and credentials");
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn’t complete the response.");
    expect(html).toContain(">Retry</button>");
    expect(html).not.toContain("private upstream");
  });

  it("labels interrupted output and hides feedback and active reasoning", () => {
    chat.status = "error";
    chat.error = new Error("stream failed");
    chat.messages.push({
      id: "answer",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Partial reasoning", state: "streaming" },
        { type: "text", text: "Partial answer", state: "streaming" },
      ],
    });
    const html = render();
    expect(html).toContain("Partial answer");
    expect(html).toContain("Incomplete response");
    expect(html).toContain("Reasoning interrupted");
    expect(html).not.toContain("THINKING");
    expect(html).not.toContain("Helpful");
  });

  it("leaves completed responses unchanged and hides the error controls", () => {
    chat.messages.push({
      id: "answer",
      role: "assistant",
      parts: [{ type: "text", text: "Complete answer", state: "done" }],
    });
    const html = render();
    expect(html).toContain("Complete answer");
    expect(html).toContain("Helpful");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Incomplete response");
    expect(html).not.toContain(">Retry</button>");
  });

  it("reports a failed new-chat reset without hiding existing messages", () => {
    newChat.isError = true;
    const html = render();
    expect(html).toContain("Hello");
    expect(html).toContain("We couldn’t start a new chat. Your messages are still here.");
  });
});

describe("chat streaming feedback", () => {
  it("shows a thinking indicator while the request is in flight with no parts yet", () => {
    chat.status = "submitted";
    chat.messages.push({ id: "answer", role: "assistant", parts: [] });
    const html = render();
    expect(html).toContain("<output");
    expect(html).toContain("THINKING");
    expect(html).not.toContain("Helpful");
  });

  it("keeps the thinking indicator before the assistant placeholder appears", () => {
    chat.status = "submitted";
    const html = render();
    expect(html).toContain("THINKING");
  });

  it("hides the thinking indicator once text starts streaming", () => {
    chat.status = "streaming";
    chat.messages.push({
      id: "answer",
      role: "assistant",
      parts: [{ type: "text", text: "Partial answer", state: "streaming" }],
    });
    const html = render();
    expect(html).toContain("Partial answer");
    expect(html).not.toContain("THINKING");
  });
});

describe("chat markdown controls", () => {
  it("keeps vertical scrolling in the StickToBottom viewport", () => {
    const html = render();

    expect(html).not.toContain("relative min-h-0 flex-1 overflow-y-auto");
  });

  it("disables Streamdown table controls while a response is streaming", () => {
    chat.status = "streaming";
    chat.messages.push({
      id: "answer",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "| Metric | Value |\n| --- | --- |\n| Sales | 100 |",
          state: "streaming",
        },
      ],
    });

    const html = render();

    expect(html).toContain('data-streamdown="table-wrapper"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="View fullscreen"/);
    expect(html).not.toContain("max-height:300px");
  });

  it("routes Vega-Lite fences to the visualization renderer", () => {
    chat.messages.push({
      id: "answer",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: '```vega-lite\n{"data":{"values":[]},"mark":"line"}\n```',
          state: "done",
        },
      ],
    });

    const html = render();

    expect(html).toContain("<figure");
    expect(html).not.toContain("language-vega-lite");
  });
});
