import "server-only";

import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { solution, theme } from "@/server/db/schema";
import { adminProcedure, createTRPCRouter } from "@/server/trpc/init";

import {
  createThemeInputSchema,
  DEFAULT_THEME_CONFIG,
  themeConfigSchema,
  themeIdInputSchema,
  updateThemeInputSchema,
  type ThemeConfig,
} from "../schemas/theme";

/**
 * Chat-only theme CRUD (FR-ADM-T), admin-only. `config` is stored as jsonb and
 * re-validated through {@link themeConfigSchema} on every read/write so the
 * shape is enforced at the tRPC boundary, not just the editor form.
 */

function toThemeDTO(row: {
  id: string;
  name: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...row, config: themeConfigSchema.parse(row.config) as ThemeConfig };
}

export const themesRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    const rows = await db.select().from(theme).orderBy(desc(theme.updatedAt));
    return rows.map(toThemeDTO);
  }),

  get: adminProcedure.input(themeIdInputSchema).query(async ({ input }) => {
    const [row] = await db.select().from(theme).where(eq(theme.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Theme not found" });
    return toThemeDTO(row);
  }),

  create: adminProcedure.input(createThemeInputSchema).mutation(async ({ input }) => {
    const [row] = await db
      .insert(theme)
      .values({ name: input.name, config: DEFAULT_THEME_CONFIG })
      .returning();
    return toThemeDTO(row!);
  }),

  update: adminProcedure.input(updateThemeInputSchema).mutation(async ({ input }) => {
    const patch: Partial<typeof theme.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.config !== undefined) patch.config = input.config;

    const [row] = await db.update(theme).set(patch).where(eq(theme.id, input.id)).returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Theme not found" });
    return toThemeDTO(row);
  }),

  remove: adminProcedure.input(themeIdInputSchema).mutation(async ({ input }) => {
    // themeId has no ON DELETE action (see data-model) — check first so the
    // admin gets a clear reason instead of a raw FK-violation error.
    const [bound] = await db
      .select({ id: solution.id })
      .from(solution)
      .where(eq(solution.themeId, input.id))
      .limit(1);
    if (bound) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This theme is assigned to a chat solution. Unassign it before deleting.",
      });
    }

    const [row] = await db.delete(theme).where(eq(theme.id, input.id)).returning({ id: theme.id });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Theme not found" });
    return { id: row.id };
  }),
});
