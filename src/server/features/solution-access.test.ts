import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: { select } }));

import { assertCanRun, assertCanSee, canSee, requiresSolutionGrant } from "./solution-access";

const admin = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: "user,admin",
  frStatus: "active" as const,
};

const member = { ...admin, id: "member-1", role: "user" };
const readySolution = { id: "solution-1", status: "ready" as const, archived: false };

describe("solution access", () => {
  beforeEach(() => select.mockReset());

  it("makes group grants optional only for administrators", () => {
    expect(requiresSolutionGrant(admin)).toBe(false);
    expect(requiresSolutionGrant(member)).toBe(true);
  });

  it("lets an administrator see and run a ready solution without querying grants", async () => {
    await expect(canSee(admin, readySolution)).resolves.toBe(true);
    await expect(assertCanSee(admin, readySolution)).resolves.toBeUndefined();
    await expect(assertCanRun(admin, readySolution)).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it.each([
    { ...readySolution, archived: true },
    { ...readySolution, status: "draft" as const },
  ])("keeps lifecycle visibility gates for administrators", async (solution) => {
    await expect(canSee(admin, solution)).resolves.toBe(false);
    await expect(assertCanSee(admin, solution)).rejects.toBeInstanceOf(TRPCError);
    expect(select).not.toHaveBeenCalled();
  });
});
