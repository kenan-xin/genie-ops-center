import { z } from "zod";

/**
 * Shared zod schemas for the Groups + Access slice (FR-ADM-G / FR-ADM-O).
 * The same schemas back the tRPC `groups` router and the inspector's
 * react-hook-form + TransferList. No `server-only` import — client-safe.
 *
 * Membership / grant edits are *whole-set* writes: the client sends the full
 * desired list of member ids (or solution ids) and the router diff-syncs the
 * join tables. That matches how TransferList emits its controlled `value` and
 * keeps the mutation surface tiny (one setMembers / one setSolutions).
 */

export const listGroupsSchema = z.object({
  search: z.string().trim().max(200).optional(),
});
export type ListGroupsInput = z.infer<typeof listGroupsSchema>;

const nameSchema = z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters");

export const createGroupSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(280, "Keep it under 280 characters").optional(),
});
export type CreateGroupValues = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  id: z.string().min(1),
  name: nameSchema.optional(),
  description: z.string().trim().max(280).optional(),
});
export type UpdateGroupValues = z.infer<typeof updateGroupSchema>;

export const groupIdSchema = z.object({ id: z.string().min(1) });

/** Whole-set membership write: the complete desired list of member user ids. */
export const setMembersSchema = z.object({
  groupId: z.string().min(1),
  userIds: z.array(z.string().min(1)),
});
export type SetMembersValues = z.infer<typeof setMembersSchema>;

/** Whole-set grant write: the complete desired list of granted solution ids. */
export const setSolutionsSchema = z.object({
  groupId: z.string().min(1),
  solutionIds: z.array(z.string().min(1)),
});
export type SetSolutionsValues = z.infer<typeof setSolutionsSchema>;

/** A directory row — the `groups.list` output shape. */
export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  solutionCount: number;
};

/** A person selectable for membership (the "Available" side). */
export type MemberOption = {
  id: string;
  name: string;
  email: string;
};

/** A solution selectable for granting (the "Available" side). */
export type SolutionOption = {
  id: string;
  name: string;
  monogram: string | null;
  status: "ready" | "draft" | "maintenance" | "down";
  archived: boolean;
};

/** Full inspector payload — `groups.get` output. */
export type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
  solutionIds: string[];
};
