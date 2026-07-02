import { z } from "zod";

/**
 * Shared zod schemas for the People directory (FR-ADM-P) — the same schemas
 * the invite/edit forms (react-hook-form + zodResolver) and the `users` tRPC
 * router validate against. No `server-only` import: this file is imported by
 * client components too.
 */

export const personRoleSchema = z.enum(["user", "admin"]);
export type PersonRole = z.infer<typeof personRoleSchema>;

/**
 * UI label for the FR's "role" column — "admin"/"user" are the stored values.
 * "Workspace Owner" is the prototype/epic-brief's term for an elevated member
 * (proto lines 334, 1284, 1917) — the same underlying `admin` role.
 */
export const ROLE_LABEL: Record<PersonRole, string> = {
  admin: "Workspace Owner",
  user: "Member",
};

/** Options for the add/edit person role segmented control (proto 1048). */
export const ROLE_OPTIONS: { value: PersonRole; label: string }[] = [
  { value: "user", label: ROLE_LABEL.user },
  { value: "admin", label: ROLE_LABEL.admin },
];

export const personStatusSchema = z.enum(["active", "pending", "disabled"]);
export type PersonStatus = z.infer<typeof personStatusSchema>;

export const STATUS_LABEL: Record<PersonStatus, string> = {
  active: "Active",
  pending: "Pending",
  disabled: "Disabled",
};

export const personSortSchema = z.enum(["name", "role", "status"]);
export type PersonSort = z.infer<typeof personSortSchema>;

export const listPeopleSchema = z.object({
  search: z.string().trim().max(200).optional(),
  sort: personSortSchema.default("name"),
});
export type ListPeopleInput = z.infer<typeof listPeopleSchema>;

const nameSchema = z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters");
const emailSchema = z.string().trim().pipe(z.email("Enter a valid email"));

export const invitePersonSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: personRoleSchema,
});
export type InvitePersonValues = z.infer<typeof invitePersonSchema>;

export const editPersonSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
  email: emailSchema,
  role: personRoleSchema,
});
export type EditPersonValues = z.infer<typeof editPersonSchema>;

export const personIdSchema = z.object({ id: z.string().min(1) });

/** A directory row — the `users.list` output shape. */
export type Person = {
  id: string;
  name: string;
  email: string;
  role: PersonRole;
  status: PersonStatus;
  groups: { id: string; name: string }[];
  /** ISO string, or null if the person has never had a session. */
  lastActiveAt: string | null;
};
