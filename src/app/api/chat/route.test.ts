import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerAuth, select } = vi.hoisted(() => ({
  getServerAuth: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/authz", async () => ({
  getServerAuth,
  TRPCError: (await import("@trpc/server")).TRPCError,
}));
vi.mock("@/server/db", () => ({ db: { select } }));

import { POST } from "./route";
import { CHAT_MAX_REQUEST_BYTES } from "@/features/chat/server/request-body";

describe("chat request guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerAuth.mockResolvedValue({ status: "authenticated", user: { id: "test-user" } });
    select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
  });

  it.each([
    ["unauthenticated", 401],
    ["password-change-required", 403],
  ])("rejects %s before reading the body", async (status, code) => {
    getServerAuth.mockResolvedValue({ status });
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: "x".repeat(CHAT_MAX_REQUEST_BYTES + 1),
    });
    const getReader = vi.spyOn(request.body!, "getReader");
    expect((await POST(request)).status).toBe(code);
    expect(getReader).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("rejects an authenticated oversized body with 413 before querying solutions", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/chat", {
        method: "POST",
        body: "x".repeat(CHAT_MAX_REQUEST_BYTES + 1),
      }),
    );
    expect(response.status).toBe(413);
    expect(select).not.toHaveBeenCalled();
  });

  it("preserves validation and solution lookup for ordinary requests", async () => {
    const request = (body: string) =>
      new NextRequest("http://localhost/api/chat", {
        method: "POST",
        body,
      });
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ prompt: "hello" })))).status).toBe(400);
    expect(select).not.toHaveBeenCalled();
    expect(
      (
        await POST(
          request(
            JSON.stringify({
              solutionId: "ed5c9194-c45e-4eaa-9d29-73e2f4ce5e21",
              prompt: "hello",
            }),
          ),
        )
      ).status,
    ).toBe(404);
    expect(select).toHaveBeenCalledOnce();
  });
});
