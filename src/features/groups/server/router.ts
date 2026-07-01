import { adminProcedure, createTRPCRouter } from "@/server/trpc/init";

import {
  createGroupSchema,
  groupIdSchema,
  listGroupsSchema,
  setMembersSchema,
  setSolutionsSchema,
  updateGroupSchema,
} from "../schemas/group";
import * as groupService from "./group-service";

/**
 * Admin Groups + Access (FR-ADM-G / FR-ADM-O). Every procedure is
 * admin-gated. Membership/grant edits are whole-set writes consumed straight
 * from the inspector's TransferList; the Access Overview reuses the same
 * membership ∩ grant union the access predicates read (single source of truth).
 */
export const groupsRouter = createTRPCRouter({
  list: adminProcedure.input(listGroupsSchema.optional()).query(async ({ input }) => {
    return groupService.listGroups(input?.search);
  }),

  /** Inspector payload + the selectable catalogs for both transfer lists. */
  get: adminProcedure.input(groupIdSchema).query(async ({ input }) => {
    const [detail, members, solutions] = await Promise.all([
      groupService.getGroupDetail(input.id),
      groupService.listMemberOptions(),
      groupService.listSolutionOptions(),
    ]);
    return { detail, members, solutions };
  }),

  create: adminProcedure.input(createGroupSchema).mutation(async ({ input }) => {
    return groupService.createGroup(input.name, input.description);
  }),

  update: adminProcedure.input(updateGroupSchema).mutation(async ({ input }) => {
    await groupService.updateGroup(input.id, { name: input.name, description: input.description });
    return { id: input.id };
  }),

  remove: adminProcedure.input(groupIdSchema).mutation(async ({ input }) => {
    await groupService.deleteGroup(input.id);
    return { id: input.id };
  }),

  setMembers: adminProcedure.input(setMembersSchema).mutation(async ({ input }) => {
    await groupService.setMembers(input.groupId, input.userIds);
    return { groupId: input.groupId };
  }),

  setSolutions: adminProcedure.input(setSolutionsSchema).mutation(async ({ input }) => {
    await groupService.setSolutions(input.groupId, input.solutionIds);
    return { groupId: input.groupId };
  }),

  overviewBySolution: adminProcedure.query(async () => {
    return groupService.overviewBySolution();
  }),

  overviewByPerson: adminProcedure.query(async () => {
    return groupService.overviewByPerson();
  }),
});
