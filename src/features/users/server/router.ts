import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { group, groupMember, session, user } from "@/server/db/schema";
import { deriveFrStatus, isAdmin } from "@/server/authz";
import { adminProcedure, createTRPCRouter } from "@/server/trpc/init";

import {
  editPersonSchema,
  invitePersonSchema,
  listPeopleSchema,
  personIdSchema,
  ROLE_LABEL,
  type ListPeopleInput,
  type Person,
  type PersonRole,
} from "../schemas/person";
import * as userService from "./user-service";

/**
 * Admin People (FR-ADM-P). Every mutation here forwards `ctx.headers` (the
 * caller's session cookie) into the single domain service — never a raw
 * `auth.api.<admin>` call — so lifecycle enforcement stays centralized
 * (tech-plan → "Person lifecycle").
 */
export const usersRouter = createTRPCRouter({
  list: adminProcedure.input(listPeopleSchema.optional()).query(async ({ input }) => {
    return listPeople(input ?? { sort: "name" });
  }),

  invite: adminProcedure.input(invitePersonSchema).mutation(async ({ ctx, input }) => {
    return userService.inviteUser({
      name: input.name,
      email: input.email,
      role: input.role,
      headers: ctx.headers,
    });
  }),

  update: adminProcedure.input(editPersonSchema).mutation(async ({ ctx, input }) => {
    await userService.updateUserProfile(
      input.id,
      { name: input.name, email: input.email },
      ctx.headers,
    );
    if (input.role === "admin") {
      await userService.setAdmin(input.id, ctx.headers);
    } else {
      await userService.clearAdmin(input.id, ctx.headers);
    }
    return { id: input.id };
  }),

  disable: adminProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    await userService.disableUser(input.id, ctx.headers);
  }),

  enable: adminProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    await userService.enableUser(input.id, ctx.headers);
  }),

  /** "Email reset link" (active) and "Resend invite" (pending) are the same call. */
  sendResetLink: adminProcedure.input(personIdSchema).mutation(async ({ input }) => {
    const [row] = await db
      .select({ email: user.email, status: user.status })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
    await userService.sendPasswordReset(row.email, row.status === "pending" ? "activate" : "reset");
  }),

  setTempPassword: adminProcedure
    .input(personIdSchema.extend({ requireChange: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      return userService.adminSetTempPassword(input.id, ctx.headers, {
        requireChange: input.requireChange,
      });
    }),

  /** "Activate now" for a still-pending person (FR-ADM-P-04) — bypasses the reset-link email. */
  activate: adminProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    return userService.adminSetTempPassword(input.id, ctx.headers, { activate: true });
  }),

  forceSignOut: adminProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    await userService.revokeUserSessions(input.id, ctx.headers);
  }),

  remove: adminProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    await userService.removeUser(input.id, ctx.headers);
  }),
});

/**
 * Directory listing (FR-ADM-P-01). The whole roster is fetched and merged/
 * filtered in JS: a single-customer admin portal's user count doesn't warrant
 * SQL-side search/sort, and search must match the *displayed* role label
 * ("Admin"/"Member"), not the raw multi-value role string.
 */
async function listPeople(input: ListPeopleInput): Promise<Person[]> {
  const [rows, groupRows, lastActiveRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        banned: user.banned,
      })
      .from(user),
    db
      .select({ userId: groupMember.userId, groupId: group.id, groupName: group.name })
      .from(groupMember)
      .innerJoin(group, eq(group.id, groupMember.groupId)),
    db
      .select({ userId: session.userId, lastActiveAt: sql<string>`max(${session.updatedAt})` })
      .from(session)
      .groupBy(session.userId),
  ]);

  const groupsByUser = new Map<string, Person["groups"]>();
  for (const g of groupRows) {
    const list = groupsByUser.get(g.userId) ?? [];
    list.push({ id: g.groupId, name: g.groupName });
    groupsByUser.set(g.userId, list);
  }
  const lastActiveByUser = new Map(lastActiveRows.map((r) => [r.userId, r.lastActiveAt]));

  let people: Person[] = rows.map((u) => {
    const role: PersonRole = isAdmin({ role: u.role ?? "user" }) ? "admin" : "user";
    const lastActiveAt = lastActiveByUser.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role,
      status: deriveFrStatus(u),
      groups: (groupsByUser.get(u.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      lastActiveAt: lastActiveAt ? new Date(lastActiveAt).toISOString() : null,
    };
  });

  const term = input.search?.trim().toLowerCase();
  if (term) {
    people = people.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        ROLE_LABEL[p.role].toLowerCase().includes(term),
    );
  }

  people.sort((a, b) => {
    if (input.sort === "role") {
      return ROLE_LABEL[a.role].localeCompare(ROLE_LABEL[b.role]) || a.name.localeCompare(b.name);
    }
    if (input.sort === "status") {
      return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  return people;
}
