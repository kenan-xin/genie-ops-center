import "server-only";

import { TRPCError } from "@trpc/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";

import { allowedIframeOrigins, chatAllowedOrigins } from "@/server/config";
import { db } from "@/server/db";
import { solution, theme } from "@/server/db/schema";
import { assertAllowedEndpoint } from "@/lib/url-guard";
import { adminProcedure, createTRPCRouter } from "@/server/trpc/init";

import {
  configByTypeSchema,
  DEFAULT_CHAT_API_ENDPOINT,
  editSolutionSchema,
  listSolutionsSchema,
  registerSolutionSchema,
  setStatusSchema,
  slugify,
  solutionIdSchema,
  type ChatConfig,
  type EmbeddedConfig,
  type NativeConfig,
  type Solution,
  type SolutionType,
} from "../schemas/solution";

/**
 * Admin Solutions (FR-ADM-S). Admin-only. `config` is stored as jsonb and
 * re-validated through {@link configByTypeSchema} on every read/write so the
 * per-type shape is enforced at the tRPC boundary, not just the form. The
 * theme-bind invariant — `themeId` settable only when `type='chat'` — is
 * enforced in `update`/`register`, not by a DB constraint.
 */

type DbSolution = typeof solution.$inferSelect;

/**
 * SSRF gate for chat solutions (FR-ADM-S-03): the endpoint's origin must be on
 * the ops allow-list (`GENIE_CHAT_API_ALLOWED_ORIGINS`). No-op for non-chat.
 * Re-checked before the proxy fetch in ticket 13; this is the write boundary.
 */
function assertChatEndpointAllowed(
  type: SolutionType,
  config: ChatConfig | EmbeddedConfig | NativeConfig,
): void {
  if (type !== "chat") return;
  // Not configured yet (fresh draft from register) — nothing to allow-list.
  if (!(config as ChatConfig).apiEndpoint) return;
  try {
    assertAllowedEndpoint(
      (config as ChatConfig).apiEndpoint,
      chatAllowedOrigins(),
      "apiEndpoint",
      "apiEndpoint rejected: no chat API origins are allow-listed (set GENIE_CHAT_API_ALLOWED_ORIGINS)",
    );
  } catch (e) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "Chat endpoint not allowed",
    });
  }
}

/**
 * iframe origin gate (FR-VIEW-04): an embedded solution's iframeUrl must be on
 * the CSP `frame-src` allow-list (`ALLOWED_IFRAME_ORIGINS`) — same trust model
 * as the chat endpoint. Without this, a stored unapproved origin bypasses CSP
 * via the "Open in new tab" anchor. Re-checked in resolveViewerSurface too.
 */
function assertIframeUrlAllowed(
  type: SolutionType,
  config: ChatConfig | EmbeddedConfig | NativeConfig,
): void {
  if (type !== "embedded") return;
  // Not configured yet (fresh draft from register) — nothing to allow-list.
  if (!(config as EmbeddedConfig).iframeUrl) return;
  try {
    assertAllowedEndpoint(
      (config as EmbeddedConfig).iframeUrl,
      allowedIframeOrigins(),
      "iframeUrl",
      "iframeUrl rejected: no iframe origins are allow-listed (set ALLOWED_IFRAME_ORIGINS)",
    );
  } catch (e) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "iframe URL not allowed",
    });
  }
}

/** Apply both origin gates for the given type (chat → endpoint, embedded → iframe). */
function assertOriginsAllowed(
  type: SolutionType,
  config: ChatConfig | EmbeddedConfig | NativeConfig,
): void {
  assertChatEndpointAllowed(type, config);
  assertIframeUrlAllowed(type, config);
}

function toSolution(row: DbSolution, themeName: string | null = null): Solution {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type as SolutionType,
    status: row.status,
    description: row.description,
    monogram: row.monogram,
    accentColor: row.accentColor,
    accentColorInvert: row.accentColorInvert,
    archived: row.archived,
    themeId: row.themeId,
    themeName,
    config: parseConfig(row.type, row.config),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Resolve each row's themeName in one query (avoids an N+1 in `list`). */
async function themeNamesFor(rows: DbSolution[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.themeId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const themes = await db.select({ id: theme.id, name: theme.name }).from(theme);
  return new Map(themes.filter((t) => ids.includes(t.id)).map((t) => [t.id, t.name]));
}

/** Single-row themeName lookup (mutations/get). */
async function themeNameOf(row: DbSolution): Promise<Solution> {
  if (!row.themeId) return toSolution(row);
  const map = await themeNamesFor([row]);
  return toSolution(row, map.get(row.themeId) ?? null);
}

function parseConfig(type: string, raw: unknown): ChatConfig | EmbeddedConfig | NativeConfig {
  const parsed = configByTypeSchema.safeParse({ type, config: raw });
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Invalid config for solution type "${type}"`,
    });
  }
  return parsed.data.config;
}

function monogramOf(name: string): string {
  const letters = name
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return (letters[0] ?? "?") + (letters[1] ?? "");
}

/**
 * First unused slug for `base` (suffixed on collision). A single-customer admin
 * portal's solution count is small; a bounded suffix loop is simpler than a
 * CTE-exclusion and stops at the first gap.
 */
async function resolveUniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let slug = base;
  let n = 2;
  for (;;) {
    const conditions = [eq(solution.slug, slug)];
    if (ignoreId) conditions.push(sql`${solution.id} <> ${ignoreId}`);
    // Sequential by necessity: each suffix probe only runs if the previous slug
    // collided, so the checks can't be parallelized.
    // eslint-disable-next-line no-await-in-loop
    const [clash] = await db
      .select({ id: solution.id })
      .from(solution)
      .where(and(...conditions))
      .limit(1);
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
}

export const solutionsRouter = createTRPCRouter({
  list: adminProcedure.input(listSolutionsSchema.optional()).query(async ({ input }) => {
    const filter = input ?? { sort: "updated" };
    const conditions = [];
    if (filter.type) conditions.push(eq(solution.type, filter.type));
    if (filter.status) conditions.push(eq(solution.status, filter.status));
    if (filter.archived !== undefined) conditions.push(eq(solution.archived, filter.archived));

    const term = filter.search?.trim();
    if (term) {
      conditions.push(or(ilike(solution.name, `%${term}%`), ilike(solution.slug, `%${term}%`))!);
    }

    let rows: DbSolution[];
    if (conditions.length > 0) {
      rows = await db
        .select()
        .from(solution)
        .where(and(...conditions));
    } else {
      rows = await db.select().from(solution);
    }

    const themeNameById = await themeNamesFor(rows);
    const items = rows.map((r) =>
      toSolution(r, r.themeId ? (themeNameById.get(r.themeId) ?? null) : null),
    );

    items.sort((a, b) => {
      if (filter.sort === "name") return a.name.localeCompare(b.name);
      if (filter.sort === "status") {
        // Stable-ish: down < maintenance < draft < ready by severity, then name.
        const w: Record<string, number> = { down: 0, maintenance: 1, draft: 2, ready: 3 };
        return (w[a.status] ?? 9) - (w[b.status] ?? 9) || a.name.localeCompare(b.name);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return items;
  }),

  get: adminProcedure.input(solutionIdSchema).query(async ({ input }) => {
    const [row] = await db.select().from(solution).where(eq(solution.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    return themeNameOf(row);
  }),

  register: adminProcedure.input(registerSolutionSchema).mutation(async ({ input }) => {
    // Registration collects name/type/description only (FR-ADM-S-02) — seed a
    // blank/defaulted config for the picked type; the admin fills it in later
    // from Configure. `configByTypeSchema` still re-validates the shape below.
    const draftConfig: ChatConfig | EmbeddedConfig =
      input.type === "chat"
        ? { botUuid: "", apiEndpoint: DEFAULT_CHAT_API_ENDPOINT, feedbackEnabled: true }
        : { iframeUrl: "" };
    const validated = configByTypeSchema.safeParse({
      type: input.type,
      config: draftConfig,
    });
    if (!validated.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Configuration doesn't match the selected type.",
      });
    }
    assertOriginsAllowed(input.type, validated.data.config);
    const slug = await resolveUniqueSlug(slugify(input.name));
    const [row] = await db
      .insert(solution)
      .values({
        name: input.name,
        slug,
        type: input.type,
        status: "draft", // registered solutions start as Draft (FR-ADM-S-02)
        description: input.description ?? null,
        monogram: monogramOf(input.name),
        archived: false,
        config: validated.data.config,
        themeId: null,
      })
      .returning();
    return themeNameOf(row!);
  }),

  update: adminProcedure.input(editSolutionSchema).mutation(async ({ input }) => {
    const validated = configByTypeSchema.safeParse({
      type: input.type,
      config: input.config,
    });
    if (!validated.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Configuration doesn't match the selected type.",
      });
    }
    assertOriginsAllowed(input.type, validated.data.config);
    // themeId⇔type invariant (tech-plan → data-model): only chat may bind a theme.
    if (input.themeId && input.type !== "chat") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only chat solutions can bind a theme.",
      });
    }
    if (input.themeId) {
      const [t] = await db
        .select({ id: theme.id })
        .from(theme)
        .where(eq(theme.id, input.themeId))
        .limit(1);
      if (!t) throw new TRPCError({ code: "BAD_REQUEST", message: "Theme not found" });
    }

    // Bump chatConfigVersion when the backend-identifying config changes, so the
    // chat proxy won't persist a conversation handle against a stale backend
    // (FR-ADM-S-03 / critique B3). Compare against the stored row.
    const [existing] = await db
      .select({ type: solution.type, config: solution.config })
      .from(solution)
      .where(eq(solution.id, input.id))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    const oldChat = existing.type === "chat" ? (existing.config as Partial<ChatConfig>) : null;
    const newChat = input.type === "chat" ? (validated.data.config as ChatConfig) : null;
    const backendChanged =
      newChat != null &&
      (oldChat == null ||
        oldChat.apiEndpoint !== newChat.apiEndpoint ||
        oldChat.botUuid !== newChat.botUuid);

    const slug = await resolveUniqueSlug(slugify(input.name), input.id);
    const [row] = await db
      .update(solution)
      .set({
        name: input.name,
        slug,
        description: input.description ?? null,
        monogram: monogramOf(input.name),
        type: input.type,
        config: validated.data.config,
        themeId: input.type === "chat" ? (input.themeId ?? null) : null,
        ...(backendChanged ? { chatConfigVersion: sql`${solution.chatConfigVersion} + 1` } : {}),
        updatedAt: new Date(),
      })
      .where(eq(solution.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    return themeNameOf(row);
  }),

  setStatus: adminProcedure.input(setStatusSchema).mutation(async ({ input }) => {
    const [row] = await db
      .update(solution)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(solution.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    return themeNameOf(row);
  }),

  /** Duplicate (FR-ADM-S-04): a Draft copy of an existing solution. */
  duplicate: adminProcedure.input(solutionIdSchema).mutation(async ({ input }) => {
    const [src] = await db.select().from(solution).where(eq(solution.id, input.id)).limit(1);
    if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });

    const copyName = `${src.name} copy`;
    const slug = await resolveUniqueSlug(slugify(copyName));
    const [row] = await db
      .insert(solution)
      .values({
        name: copyName,
        slug,
        type: src.type,
        status: "draft",
        description: src.description,
        monogram: monogramOf(copyName),
        archived: false,
        config: src.config,
        themeId: src.type === "chat" ? src.themeId : null,
      })
      .returning();
    return themeNameOf(row!);
  }),

  archive: adminProcedure.input(solutionIdSchema).mutation(async ({ input }) => {
    const [row] = await db
      .update(solution)
      .set({ archived: true, updatedAt: new Date() })
      .where(eq(solution.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    return themeNameOf(row);
  }),

  unarchive: adminProcedure.input(solutionIdSchema).mutation(async ({ input }) => {
    const [row] = await db
      .update(solution)
      .set({ archived: false, updatedAt: new Date() })
      .where(eq(solution.id, input.id))
      .returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    return themeNameOf(row);
  }),

  /** Delete (FR-ADM-S-04): cascades group_solution / favorite / recent (FK on-delete cascade). */
  remove: adminProcedure.input(solutionIdSchema).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(solution)
      .where(eq(solution.id, input.id))
      .returning({ id: solution.id });
    if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Solution not found" });
    return { id: deleted.id };
  }),
});
