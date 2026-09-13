import { describe, expect, it } from "vitest";

import { buildSidebarEntries } from "./sidebar-entries";

import type { HubSolution } from "@/features/solutions-hub/server/queries";

function solutionFixture(id: string, name: string): HubSolution {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    type: "embedded",
    status: "ready",
    description: null,
    monogram: null,
    accentColor: null,
    accentColorInvert: null,
    isFavorite: false,
    lastOpenedAt: null,
    updatedAt: "2026-09-13T00:00:00.000Z",
  };
}

const financial = { id: "cat-1", name: "Financial", position: 0 };
const legal = { id: "cat-2", name: "Legal", position: 1 };
const loan = solutionFixture("sol-1", "Loan Review");
const kyc = solutionFixture("sol-2", "KYC Screening");

describe("buildSidebarEntries", () => {
  it("puts categories first in position order, then standalone solutions", () => {
    const entries = buildSidebarEntries(
      [legal, financial],
      [loan, kyc],
      new Map([[loan.id, financial.id]]),
    );
    expect(entries).toEqual([
      { kind: "category", category: { id: "cat-1", name: "Financial", solutions: [loan] } },
      { kind: "solution", solution: kyc },
    ]);
  });

  it("drops a category with no solutions the user can reach", () => {
    const entries = buildSidebarEntries(
      [financial, legal],
      [loan],
      new Map([[loan.id, financial.id]]),
    );
    expect(entries.some((e) => e.kind === "category" && e.category.id === legal.id)).toBe(false);
  });

  it("treats an assignment to an unknown category as standalone", () => {
    const entries = buildSidebarEntries([financial], [kyc], new Map([[kyc.id, "cat-gone"]]));
    expect(entries).toEqual([{ kind: "solution", solution: kyc }]);
  });

  it("sorts solutions inside a category by name", () => {
    const entries = buildSidebarEntries(
      [financial],
      [kyc, loan],
      new Map([
        [kyc.id, financial.id],
        [loan.id, financial.id],
      ]),
    );
    expect(entries[0]).toEqual({
      kind: "category",
      category: { id: "cat-1", name: "Financial", solutions: [kyc, loan] },
    });
  });

  it("keeps standalone solutions in name order", () => {
    const entries = buildSidebarEntries([], [loan, kyc], new Map());
    expect(entries.map((e) => (e.kind === "solution" ? e.solution.name : ""))).toEqual([
      "KYC Screening",
      "Loan Review",
    ]);
  });

  it("returns an empty list when the user can reach nothing", () => {
    expect(buildSidebarEntries([financial], [], new Map())).toEqual([]);
  });
});
