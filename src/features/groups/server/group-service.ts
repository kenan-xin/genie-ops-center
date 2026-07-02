import "server-only";

import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { group, groupMember, groupSolution, solution, user } from "@/server/db/schema";
import type { GroupDetail, GroupSummary, MemberOption, SolutionOption } from "../schemas/group";

/**
 * Group domain logic (FR-ADM-G) — admin-only at the router tier. Access is
 * granted to groups only; membership and grants live in `group_member` /
 * `group_solution` and are whole-set diff-synced from the inspector's
 * TransferList ({@link setMembers} / {@link setSolutions}).
 *
 * The reachable-solutions union (`group_member` → `group` → `group_solution`)
 * is the single source of truth the Access Overview explorer reads — the same
 * shape `solution-access.ts` predicates against, not a re-query.
 */

function notFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
}

export async function listGroups(search?: string): Promise<GroupSummary[]> {
  const [rows, memberCounts, solutionCounts] = await Promise.all([
    db
      .select({ id: group.id, name: group.name, description: group.description })
      .from(group)
      .orderBy(group.name),
    db
      .select({ groupId: groupMember.groupId, n: sql<number>`count(*)::int` })
      .from(groupMember)
      .groupBy(groupMember.groupId),
    db
      .select({ groupId: groupSolution.groupId, n: sql<number>`count(*)::int` })
      .from(groupSolution)
      .groupBy(groupSolution.groupId),
  ]);

  const mByGroup = new Map(memberCounts.map((r) => [r.groupId, r.n]));
  const sByGroup = new Map(solutionCounts.map((r) => [r.groupId, r.n]));

  let summaries: GroupSummary[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    memberCount: mByGroup.get(r.id) ?? 0,
    solutionCount: sByGroup.get(r.id) ?? 0,
  }));

  const term = search?.trim().toLowerCase();
  if (term) {
    summaries = summaries.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.description?.toLowerCase().includes(term) ?? false),
    );
  }
  return summaries;
}

export async function getGroupOrThrow(id: string) {
  const [row] = await db
    .select({ id: group.id, name: group.name, description: group.description })
    .from(group)
    .where(eq(group.id, id))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function getGroupDetail(id: string): Promise<GroupDetail> {
  const row = await getGroupOrThrow(id);
  const [members, grants] = await Promise.all([
    db.select({ userId: groupMember.userId }).from(groupMember).where(eq(groupMember.groupId, id)),
    db
      .select({ solutionId: groupSolution.solutionId })
      .from(groupSolution)
      .where(eq(groupSolution.groupId, id)),
  ]);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    memberIds: members.map((m) => m.userId),
    solutionIds: grants.map((g) => g.solutionId),
  };
}

/** People selectable as members — disabled (banned) excluded; pending stays selectable. */
export async function listMemberOptions(): Promise<MemberOption[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, banned: user.banned })
    .from(user);
  return rows
    .filter((u) => !u.banned)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Solutions selectable for granting — every registered solution, archived flagged. */
export async function listSolutionOptions(): Promise<SolutionOption[]> {
  return db
    .select({
      id: solution.id,
      name: solution.name,
      monogram: solution.monogram,
      status: solution.status,
      archived: solution.archived,
    })
    .from(solution)
    .orderBy(solution.name);
}

export async function createGroup(name: string, description?: string): Promise<GroupSummary> {
  const [row] = await db
    .insert(group)
    .values({ name, description: description ?? null })
    .returning({ id: group.id, name: group.name, description: group.description });
  return { ...row!, memberCount: 0, solutionCount: 0 };
}

export async function updateGroup(
  id: string,
  patch: { name?: string; description?: string },
): Promise<void> {
  const set: Partial<typeof group.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  const [row] = await db.update(group).set(set).where(eq(group.id, id)).returning({ id: group.id });
  if (!row) throw notFound();
}

export async function deleteGroup(id: string): Promise<void> {
  const [row] = await db.delete(group).where(eq(group.id, id)).returning({ id: group.id });
  if (!row) throw notFound();
  // group_member / group_solution cascade via FK onDelete.
}

/** Diff-sync `group_member` to the desired member set — only the changed rows. */
export async function setMembers(groupId: string, desiredUserIds: string[]): Promise<void> {
  await getGroupOrThrow(groupId);
  const desired = new Set(desiredUserIds);
  const current = await db
    .select({ userId: groupMember.userId })
    .from(groupMember)
    .where(eq(groupMember.groupId, groupId));
  const currentIds = new Set(current.map((r) => r.userId));

  const toAdd = [...desired].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desired.has(id));

  if (toAdd.length > 0) {
    await db
      .insert(groupMember)
      .values(toAdd.map((userId) => ({ groupId, userId })))
      .onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    await db
      .delete(groupMember)
      .where(and(eq(groupMember.groupId, groupId), inArray(groupMember.userId, toRemove)));
  }
}

/** Diff-sync `group_solution` to the desired grant set — only the changed rows. */
export async function setSolutions(groupId: string, desiredSolutionIds: string[]): Promise<void> {
  await getGroupOrThrow(groupId);
  const desired = new Set(desiredSolutionIds);
  const current = await db
    .select({ solutionId: groupSolution.solutionId })
    .from(groupSolution)
    .where(eq(groupSolution.groupId, groupId));
  const currentIds = new Set(current.map((r) => r.solutionId));

  const toAdd = [...desired].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desired.has(id));

  if (toAdd.length > 0) {
    await db
      .insert(groupSolution)
      .values(toAdd.map((solutionId) => ({ groupId, solutionId })))
      .onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    await db
      .delete(groupSolution)
      .where(and(eq(groupSolution.groupId, groupId), inArray(groupSolution.solutionId, toRemove)));
  }
}

// --- Access Overview explorer (FR-ADM-O-01) -------------------------------
// Both views read the same membership ∩ grant union that solution-access.ts
// predicates against (the single source of truth), minus archived solutions.

export type SolutionReach = {
  solution: SolutionOption;
  groups: { id: string; name: string; memberCount: number }[];
  people: { id: string; name: string; email: string }[];
};

export type PersonReach = {
  person: { id: string; name: string; email: string };
  groups: { id: string; name: string }[];
  solutions: (SolutionOption & { grantedBy: { id: string; name: string }[] })[];
};

export async function overviewBySolution(): Promise<SolutionReach[]> {
  const [solutions_, grants, members] = await Promise.all([
    db
      .select({
        id: solution.id,
        name: solution.name,
        monogram: solution.monogram,
        status: solution.status,
        archived: solution.archived,
      })
      .from(solution)
      .where(eq(solution.archived, false))
      .orderBy(solution.name),
    db
      .select({ solutionId: groupSolution.solutionId, groupId: group.id, groupName: group.name })
      .from(groupSolution)
      .innerJoin(group, eq(group.id, groupSolution.groupId)),
    db
      .select({
        groupId: groupMember.groupId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      })
      .from(groupMember)
      .innerJoin(user, eq(user.id, groupMember.userId)),
  ]);

  const groupsBySolution = new Map<string, { id: string; name: string }[]>();
  for (const g of grants) {
    const list = groupsBySolution.get(g.solutionId) ?? [];
    list.push({ id: g.groupId, name: g.groupName });
    groupsBySolution.set(g.solutionId, list);
  }
  const peopleByGroup = new Map<string, { id: string; name: string; email: string }[]>();
  for (const m of members) {
    const list = peopleByGroup.get(m.groupId) ?? [];
    list.push({ id: m.userId, name: m.userName, email: m.userEmail });
    peopleByGroup.set(m.groupId, list);
  }

  return solutions_.map((s) => {
    const grantGroups = groupsBySolution.get(s.id) ?? [];
    const personSet = new Map<string, { id: string; name: string; email: string }>();
    for (const g of grantGroups)
      for (const p of peopleByGroup.get(g.id) ?? []) personSet.set(p.id, p);
    return {
      solution: {
        id: s.id,
        name: s.name,
        monogram: s.monogram,
        status: s.status,
        archived: s.archived,
      },
      groups: grantGroups
        .map((g) => ({ ...g, memberCount: peopleByGroup.get(g.id)?.length ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      people: [...personSet.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

export async function overviewByPerson(): Promise<PersonReach[]> {
  const [people, memberships, grants] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, banned: user.banned })
      .from(user)
      .orderBy(user.name),
    db
      .select({ groupId: groupMember.groupId, groupName: group.name, userId: groupMember.userId })
      .from(groupMember)
      .innerJoin(group, eq(group.id, groupMember.groupId)),
    db
      .select({
        solutionId: solution.id,
        solutionName: solution.name,
        monogram: solution.monogram,
        status: solution.status,
        archived: solution.archived,
        groupId: groupSolution.groupId,
        groupName: group.name,
      })
      .from(groupSolution)
      .innerJoin(solution, eq(solution.id, groupSolution.solutionId))
      .innerJoin(group, eq(group.id, groupSolution.groupId)),
  ]);

  // Index grant rows by group → its granted solutions (full rows).
  const solutionsByGroup = new Map<string, SolutionOption[]>();
  const grantorsBySolutionGroup = new Map<string, { id: string; name: string }>();
  for (const g of grants) {
    const sol: SolutionOption = {
      id: g.solutionId,
      name: g.solutionName,
      monogram: g.monogram,
      status: g.status,
      archived: g.archived,
    };
    const list = solutionsByGroup.get(g.groupId) ?? [];
    list.push(sol);
    solutionsByGroup.set(g.groupId, list);
    grantorsBySolutionGroup.set(`${g.solutionId}|${g.groupId}`, {
      id: g.groupId,
      name: g.groupName,
    });
  }

  return people
    .filter((p) => !p.banned)
    .map((p) => {
      const myGroups = memberships.filter((m) => m.userId === p.id);
      // Union of solutions across this person's groups, minus archived,
      // annotated with every group that grants it.
      const reach = new Map<
        string,
        SolutionOption & { grantedBy: { id: string; name: string }[] }
      >();
      for (const m of myGroups) {
        for (const sol of solutionsByGroup.get(m.groupId) ?? []) {
          if (sol.archived) continue;
          const existing = reach.get(sol.id);
          const grantor = grantorsBySolutionGroup.get(`${sol.id}|${m.groupId}`)!;
          if (existing) {
            existing.grantedBy.push(grantor);
          } else {
            reach.set(sol.id, { ...sol, grantedBy: [grantor] });
          }
        }
      }
      return {
        person: { id: p.id, name: p.name, email: p.email },
        groups: myGroups
          .map((m) => ({ id: m.groupId, name: m.groupName }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        solutions: [...reach.values()].sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
}

export { TRPCError };
