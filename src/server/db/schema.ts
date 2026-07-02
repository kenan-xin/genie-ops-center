/**
 * Single schema source for drizzle-kit and the better-auth drizzle adapter.
 *
 * The auth tables (`user`, `session`, `account`, `verification`) are GENERATED
 * by the better-auth CLI into `./auth-schema.ts` and committed — we never
 * hand-write them. Domain tables reference `user.id` (text). One migration
 * history (drizzle-kit) owns both; better-auth's own `migrate` is never run.
 *
 * `import * as schema` (see src/server/auth.ts) lets the drizzle adapter resolve
 * every model by name. Keep this file as the one re-export point.
 */
import { desc } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import * as authSchema from "./auth-schema";

export const { user, session, account, verification } = authSchema;

// ─── Domain tables ───────────────────────────────────────────────────────────
// people ↔ groups (membership) and groups ↔ solutions (the ONLY access grant).
// One deployment = one customer → no tenant/org column anywhere.

export const group = pgTable("group", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupMember = pgTable(
  "group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    // isGrantedSolution / assertCanSee join from the user side; PK leads on
    // group_id, so the user-filtered lookup needs the reverse direction.
    index("group_member_user_id_group_id_idx").on(t.userId, t.groupId),
  ],
);

export const solution = pgTable("solution", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // derived from name at registration; /s/[slug] viewer key
  type: text("type", { enum: ["chat", "native", "embedded"] }).notNull(),
  status: text("status", { enum: ["ready", "draft", "maintenance", "down"] })
    .notNull()
    .default("draft"),
  description: text("description"),
  monogram: text("monogram"), // e.g. "PT"
  // Per-solution brand color (Wave A theming). null = neutral (--panel/--ink);
  // a hex string tints the hub mono tile, side-rail tile, and chat header/
  // avatar/bubbles/send button. accentColorInvert is the on-accent foreground.
  accentColor: text("accent_color"),
  accentColorInvert: text("accent_color_invert"),
  archived: boolean("archived").notNull().default(false),
  themeId: uuid("theme_id").references(() => theme.id), // chat-only, nullable
  config: jsonb("config").notNull().default({}), // type-specific, zod-validated at the tRPC boundary
  // Bumped when a chat solution's backend-identifying config (apiEndpoint/botUuid)
  // changes. The chat proxy reads this before calling the external API and
  // persists a conversation handle only if it's unchanged — so changing the
  // endpoint/bot can't leave a stored conversation id pointing at the old backend
  // (incl. handles that don't exist yet). See tech-plan → chat.
  chatConfigVersion: integer("chat_config_version").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupSolution = pgTable(
  "group_solution", // access grant
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    solutionId: uuid("solution_id")
      .notNull()
      .references(() => solution.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.solutionId] }),
    // "which groups grant this solution" / access-overview direction; PK leads
    // on group_id, so the solution-filtered lookup needs the reverse direction.
    index("group_solution_solution_id_group_id_idx").on(t.solutionId, t.groupId),
  ],
);

export const theme = pgTable(
  "theme", // chat-only
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    config: jsonb("config").notNull().default({}), // header color, bubble color, radius, font, placeholder, customCss, preset
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export const favorite = pgTable(
  "favorite",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    solutionId: uuid("solution_id")
      .notNull()
      .references(() => solution.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.solutionId] })],
);

export const recent = pgTable(
  "recent",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    solutionId: uuid("solution_id")
      .notNull()
      .references(() => solution.id, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.solutionId] }), // upsert openedAt; query top-6
    // Top-6 recents by recency: PK leads on user_id but its second column is
    // solution_id, which doesn't help a time-ordered read, so back the recency
    // ordering explicitly (newest-first).
    index("recent_user_id_opened_at_idx").on(t.userId, desc(t.openedAt)),
  ],
);

export const chatSessionHandle = pgTable(
  "chat_session_handle",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    solutionId: uuid("solution_id")
      .notNull()
      .references(() => solution.id, { onDelete: "cascade" }),
    externalSessionUuid: text("external_session_uuid"), // the Genie conversation id; null ⇒ next send starts a fresh conversation
    generation: integer("generation").notNull().default(0), // bumped by "New chat"; the chat route upserts the returned uuid only if generation is unchanged → guards the in-flight-stream race
    // Short-TTL in-flight send lease per (user, solution) — serializes concurrent
    // sends (ticket 13). Acquire via atomic conditional update where no unexpired
    // lease exists; clear in `finally` ONLY if leaseOwner still matches (so an old
    // request's finally can't clear a newer lease after TTL takeover).
    leaseOwner: text("lease_owner"), // random per-request token; null ⇒ no lease held
    leaseExpiresAt: timestamp("lease_expires_at"), // null or past ⇒ lease is free
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.solutionId] })],
);

// Re-export relations so drizzle adapter / queries see the full picture.
export const { userRelations, sessionRelations, accountRelations } = authSchema;
