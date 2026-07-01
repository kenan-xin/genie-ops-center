import { z } from "zod";

/**
 * Shared zod schemas for the Solutions admin slice (FR-ADM-S) — the same
 * schemas the register/edit forms (react-hook-form + zodResolver) and the
 * `solutions` tRPC router validate against. No `server-only` import: this file
 * is imported by client components too.
 *
 * `solution.config` is one JSONB column validated by a per-type discriminated
 * union (tech-plan → data-model). The theme-bind invariant — `themeId` settable
 * only when `type='chat'` — lives at the tRPC boundary, not the editor form.
 */

export const solutionTypeSchema = z.enum(["chat", "embedded"]);
export type SolutionType = z.infer<typeof solutionTypeSchema>;
// `native` is an enum-only type (tech-plan → non-goals): hidden from
// registration and the catalogue, never granted/openable. Excluded here.

/** Per-type config (discriminated union on `type`). */
export const chatConfigSchema = z.object({
  botUuid: z.string().trim().min(1, "Enter the bot UUID").max(200, "Keep it under 200 characters"),
  welcomeMessage: z.string().trim().max(2_000).optional(),
  starterPrompts: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
  feedbackEnabled: z.boolean().optional(),
});
export type ChatConfig = z.infer<typeof chatConfigSchema>;

export const embeddedConfigSchema = z.object({
  iframeUrl: z
    .string()
    .trim()
    .min(1, "Enter the iframe URL")
    .max(2_000, "Keep it under 2000 characters")
    .regex(/^https:\/\//i, "Must be an HTTPS URL"),
});
export type EmbeddedConfig = z.infer<typeof embeddedConfigSchema>;

export const nativeConfigSchema = z.object({}).strict();
export type NativeConfig = z.infer<typeof nativeConfigSchema>;

/**
 * Discriminated union over `type` — what the tRPC boundary parses `config`
 * against on every read/write. `themeId` rides alongside config at the
 * procedure-input level (not inside config) and is enforced settable only for
 * chat in the update procedure.
 */
export const configByTypeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chat"), config: chatConfigSchema }),
  z.object({ type: z.literal("embedded"), config: embeddedConfigSchema }),
  z.object({ type: z.literal("native"), config: nativeConfigSchema }),
]);
export type ConfigByType = z.infer<typeof configByTypeSchema>;

export const solutionStatusSchema = z.enum(["ready", "draft", "maintenance", "down"]);
export type SolutionStatus = z.infer<typeof solutionStatusSchema>;

export const STATUS_LABEL: Record<SolutionStatus, string> = {
  ready: "Ready",
  draft: "Draft",
  maintenance: "Maintenance",
  down: "Down",
};

const STATUS_TONE = {
  ready: "success",
  draft: "neutral",
  maintenance: "warn",
  down: "error",
} as const;
export type SolutionStatusTone = (typeof STATUS_TONE)[SolutionStatus];
export const statusTone = (s: SolutionStatus): SolutionStatusTone => STATUS_TONE[s];

export const TYPE_LABEL: Record<SolutionType, string> = {
  chat: "Chat",
  embedded: "Embedded",
};

export const solutionSortSchema = z.enum(["name", "status", "updated"]);
export type SolutionSort = z.infer<typeof solutionSortSchema>;

export const listSolutionsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: solutionTypeSchema.optional(),
  status: solutionStatusSchema.optional(),
  archived: z.boolean().optional(),
  sort: solutionSortSchema.default("updated"),
});
export type ListSolutionsInput = z.infer<typeof listSolutionsSchema>;

const nameSchema = z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters");
const descriptionSchema = z.string().trim().max(500).optional();

/** Register a solution (FR-ADM-S-02): name → slug derived, type picked, Draft. */
export const registerSolutionSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  type: solutionTypeSchema,
  config: chatConfigSchema.or(embeddedConfigSchema),
});
export type RegisterSolutionValues = z.infer<typeof registerSolutionSchema>;

/** Edit the full solution (FR-ADM-S-03): name/description/type/config + themeId. */
export const editSolutionSchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  description: descriptionSchema,
  type: solutionTypeSchema,
  // The form sends the union; the procedure re-checks themeId⇔type alignment.
  config: chatConfigSchema.or(embeddedConfigSchema),
  themeId: z.uuid().nullish(),
});
export type EditSolutionValues = z.infer<typeof editSolutionSchema>;

export const setStatusSchema = z.object({
  id: z.uuid(),
  status: solutionStatusSchema,
});

export const solutionIdSchema = z.object({ id: z.uuid() });

/** Derive a URL-safe slug from a name. Never empty — falls back to "solution". */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "solution"
  );
}

/** A directory row — the `solutions.list` output shape. */
export type Solution = {
  id: string;
  name: string;
  slug: string;
  type: SolutionType;
  status: SolutionStatus;
  description: string | null;
  monogram: string | null;
  archived: boolean;
  themeId: string | null;
  themeName: string | null;
  config: ChatConfig | EmbeddedConfig | NativeConfig;
  createdAt: string;
  updatedAt: string;
};
