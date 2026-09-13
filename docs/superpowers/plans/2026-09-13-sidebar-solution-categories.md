# Sidebar Solution Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-owned categories render as collapsible menus in the workspace sidebar, with no new permission model.

**Architecture:** Two new tables (`category`, `solution_category`) hold an admin taxonomy. The sidebar read reuses the existing `customerVisible` predicate in `solutions-hub/server/queries.ts`, so a category renders only when the user is already granted a solution inside it. A new `categories` feature slice owns admin CRUD through `adminProcedure`. Collapse state lives in `localStorage`.

**Tech Stack:** Next.js 16 (App Router), React 19, tRPC 11, drizzle-orm + drizzle-kit (PostgreSQL), zod 4, TanStack Query 5, vitest 4, oxlint, oxfmt.

**Spec:** `docs/superpowers/specs/2026-09-13-sidebar-solution-categories-design.md`

**Issue:** `genie-ops-center-t2k`

## Global Constraints

- The `group` table is the ONLY access grant. A category never grants, filters, or removes access. Never add a category to the access path in `src/server/features/solution-access.ts`.
- Naming: the new concept is `category` everywhere — table, router, files, UI copy. Never call it a group.
- Every admin procedure uses `adminProcedure`. Every customer procedure uses `protectedProcedure`. Never use the raw `t.procedure`.
- Server-side files under `src/server/` and `src/features/*/server/` start with `import "server-only";`.
- Client components start with `"use client";`.
- Form controls take their height from `src/components/ui/control-size.ts`. Never hard-code `h-8`, `h-10`, or `h-11`.
- Colours and type come from Ledger tokens, for example `var(--ink2)` and `var(--t-body)`. Never hard-code a hex value in a component.
- Run shell commands through `rtk`, for example `rtk pnpm test`.
- Track work in beads: `bd update genie-ops-center-t2k --claim` when you start, `bd close` when you finish. The checkboxes in this file track progress THROUGH THIS DOCUMENT only. Never open a TodoWrite list or a separate markdown checklist for issue state.
- Tests run in the `node` environment and only match `src/**/*.test.ts`. A `.test.tsx` file will NOT run. Test pure functions, and mock `@/server/db` the way `src/server/features/solution-access.test.ts` does.
- `pnpm dev` can crash under Console Ninja. Use `rtk pnpm build` as the smoke check.

## File Structure

**Create:**

- `src/features/categories/schemas/category.ts` — zod input schemas and shared types. Client-safe, no `server-only`.
- `src/features/categories/schemas/category.test.ts` — schema unit tests.
- `src/features/categories/lib/sidebar-entries.ts` — pure function that folds categories plus solutions into the sidebar's ordered entry list.
- `src/features/categories/lib/sidebar-entries.test.ts` — unit tests for that fold.
- `src/features/categories/server/category-service.ts` — database reads and writes for categories.
- `src/features/categories/server/router.ts` — the `categories` tRPC router.
- `src/features/categories/api/categories.ts` — client query and mutation wrappers.
- `src/features/categories/components/categories-directory.tsx` — the admin screen.
- `src/app/(admin)/admin/categories/page.tsx` — thin admin route.
- `src/app/(workspace)/_components/sidebar-categories.tsx` — the customer rail section.
- `src/app/(workspace)/_lib/use-collapsed-categories.ts` — `localStorage` collapse state.
- `src/app/(workspace)/_lib/use-collapsed-categories.test.ts` — unit tests for the pure half of that module.
- `drizzle/0005_*.sql` — generated migration plus the seed insert.

**Modify:**

- `src/server/db/schema.ts` — add the two tables.
- `src/server/trpc/router.ts` — mount `categoriesRouter`.
- `src/features/solutions-hub/lib/reorder.ts` and its test — rename `resolveFavoriteReorder` to `resolveExplicitOrder` so categories reuse it.
- `src/features/solutions-hub/server/router.ts` — update the one call site of the renamed function.
- `src/app/(workspace)/_components/workspace-chrome.tsx` — sticky nav block, scrollable rail, mount the categories section.
- `src/app/(workspace)/layout.tsx` — prefetch the sidebar query.
- `src/app/(admin)/_lib/admin-nav-items.ts` — add the Categories item.
- `src/app/globals.css` — sticky nav and thin scrollbar rules.

---

### Task 1: Schema and migration

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/0005_<generated-name>.sql` (drizzle-kit names it)

**Interfaces:**
- Consumes: nothing.
- Produces: `category` table (`id`, `name`, `position`, `createdAt`, `updatedAt`) and `solutionCategory` table (`solutionId` as primary key, `categoryId`), both exported from `src/server/db/schema.ts`.

- [ ] **Step 1: Add the tables to the schema**

Add to `src/server/db/schema.ts`, after the `theme` table:

```ts
/**
 * Admin-owned presentation taxonomy. A category NEVER grants access — the
 * `group` → `group_solution` path remains the only grant. The sidebar shows a
 * category only when the signed-in user is already granted a solution in it.
 */
export const category = pgTable("category", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const solutionCategory = pgTable(
  "solution_category",
  {
    solutionId: uuid("solution_id")
      .notNull()
      .references(() => solution.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
  },
  (t) => [
    // One category per solution TODAY, enforced by the database rather than by
    // convention: the primary key is solution_id alone. Widening to
    // many-to-many later changes this key only — no backfill, no data move.
    primaryKey({ columns: [t.solutionId] }),
    index("solution_category_category_id_idx").on(t.categoryId),
  ],
);
```

- [ ] **Step 2: Generate the migration**

Run: `rtk pnpm db:generate`
Expected: a new file appears under `drizzle/`, creating both tables.

- [ ] **Step 3: Append the seed to the generated migration**

Open the generated `drizzle/0005_*.sql` and append the statement below. Fixed UUIDs keep the seed idempotent and make the three rows identifiable across environments. They are ordinary rows, so an admin can rename or delete them.

```sql
--> statement-breakpoint
INSERT INTO category (id, name, position) VALUES
  ('9f1a7c10-0000-4000-8000-000000000001', 'Financial', 0),
  ('9f1a7c10-0000-4000-8000-000000000002', 'Healthcare', 1),
  ('9f1a7c10-0000-4000-8000-000000000003', 'Legal', 2)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 4: Apply the migration and check the types**

Run: `rtk pnpm db:migrate`
Expected: it completes with no error.

Run: `rtk pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
rtk git add src/server/db/schema.ts drizzle/
rtk git commit -m "feat(db): category and solution_category tables"
```

---

### Task 2: Category schemas

**Files:**
- Create: `src/features/categories/schemas/category.ts`
- Test: `src/features/categories/schemas/category.test.ts`

**Interfaces:**
- Consumes: `HubSolution` from `@/features/solutions-hub/server/queries`.
- Produces: `createCategorySchema`, `renameCategorySchema`, `categoryIdSchema`, `reorderCategoriesSchema`, `assignCategorySchema`, and the types `CategorySummary`, `SidebarCategory`, `SidebarEntry`.

- [ ] **Step 1: Write the failing test**

Create `src/features/categories/schemas/category.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { assignCategorySchema, createCategorySchema, reorderCategoriesSchema } from "./category";

const uuidA = "9f1a7c10-0000-4000-8000-000000000001";
const uuidB = "9f1a7c10-0000-4000-8000-000000000002";

describe("category schemas", () => {
  it("trims a category name", () => {
    expect(createCategorySchema.parse({ name: "  Financial " })).toEqual({ name: "Financial" });
  });

  it("rejects an empty category name", () => {
    expect(createCategorySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 80 characters", () => {
    expect(createCategorySchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });

  it("accepts null as the category id when a solution stands alone", () => {
    expect(assignCategorySchema.parse({ solutionId: uuidA, categoryId: null })).toEqual({
      solutionId: uuidA,
      categoryId: null,
    });
  });

  it("rejects duplicate ids in a reorder payload", () => {
    expect(reorderCategoriesSchema.safeParse({ orderedIds: [uuidA, uuidA] }).success).toBe(false);
    expect(reorderCategoriesSchema.safeParse({ orderedIds: [uuidA, uuidB] }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify that it fails**

Run: `rtk pnpm vitest run src/features/categories/schemas/category.test.ts`
Expected: FAIL, because `./category` does not exist.

- [ ] **Step 3: Write the schemas**

Create `src/features/categories/schemas/category.ts`:

```ts
import { z } from "zod";

import type { HubSolution } from "@/features/solutions-hub/server/queries";

/**
 * Shared schemas for the admin category taxonomy. Client-safe (no
 * `server-only`): the same schemas back the tRPC router and the admin form.
 *
 * A category is presentation only. It carries no access rule — see the design
 * spec, "Visibility".
 */

const nameSchema = z.string().trim().min(1, "Enter a name").max(80, "Keep it under 80 characters");

export const createCategorySchema = z.object({ name: nameSchema });
export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const categoryIdSchema = z.object({ id: z.uuid() });

export const renameCategorySchema = z.object({ id: z.uuid(), name: nameSchema });
export type RenameCategoryValues = z.infer<typeof renameCategorySchema>;

/** Whole-set order write: every category id in the admin's new order. */
export const reorderCategoriesSchema = z.object({
  orderedIds: z
    .array(z.uuid())
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, "orderedIds must not contain duplicates"),
});
export type ReorderCategoriesValues = z.infer<typeof reorderCategoriesSchema>;

/** `categoryId: null` means "this solution stands alone" — a deliberate choice. */
export const assignCategorySchema = z.object({
  solutionId: z.uuid(),
  categoryId: z.uuid().nullable(),
});
export type AssignCategoryValues = z.infer<typeof assignCategorySchema>;

/** An admin directory row — the `categories.list` output shape. */
export type CategorySummary = {
  id: string;
  name: string;
  position: number;
  solutionCount: number;
};

/** A category with the solutions this user can reach inside it. */
export type SidebarCategory = {
  id: string;
  name: string;
  solutions: HubSolution[];
};

/**
 * One row of the sidebar below the PINNED rail. Categories come first in admin
 * order, then the standalone solutions.
 */
export type SidebarEntry =
  | { kind: "category"; category: SidebarCategory }
  | { kind: "solution"; solution: HubSolution };
```

- [ ] **Step 4: Run the test to verify that it passes**

Run: `rtk pnpm vitest run src/features/categories/schemas/category.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add src/features/categories/schemas/
rtk git commit -m "feat(categories): input schemas and shared types"
```

---

### Task 3: Sidebar entry fold

**Files:**
- Create: `src/features/categories/lib/sidebar-entries.ts`
- Test: `src/features/categories/lib/sidebar-entries.test.ts`

**Interfaces:**
- Consumes: `SidebarEntry` from Task 2, `HubSolution` from `@/features/solutions-hub/server/queries`.
- Produces: `buildSidebarEntries(categories, solutions, assignments): SidebarEntry[]`, where `categories` is `{ id, name, position }[]` and `assignments` is a `Map<string, string>` of solution id to category id.

This fold holds the rule that decides what renders. It is pure, so it carries the real tests.

- [ ] **Step 1: Write the failing test**

Create `src/features/categories/lib/sidebar-entries.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify that it fails**

Run: `rtk pnpm vitest run src/features/categories/lib/sidebar-entries.test.ts`
Expected: FAIL, because `buildSidebarEntries` does not exist.

- [ ] **Step 3: Write the fold**

Create `src/features/categories/lib/sidebar-entries.ts`:

```ts
import type { SidebarEntry } from "../schemas/category";
import type { HubSolution } from "@/features/solutions-hub/server/queries";

type CategoryRow = { id: string; name: string; position: number };

/**
 * Fold the admin taxonomy and the user's reachable solutions into the sidebar's
 * ordered entries.
 *
 * Two rules carry the design:
 *  - A category renders only when the user can reach a solution inside it, so
 *    an empty category and an unreachable one look the same: absent.
 *  - A solution with no category is not an error. It becomes a first-level
 *    entry, after every category.
 */
export function buildSidebarEntries(
  categories: CategoryRow[],
  solutions: HubSolution[],
  assignments: Map<string, string>,
): SidebarEntry[] {
  const byName = (a: HubSolution, b: HubSolution) => a.name.localeCompare(b.name);
  const known = new Set(categories.map((c) => c.id));
  const grouped = new Map<string, HubSolution[]>();
  const standalone: HubSolution[] = [];

  for (const s of solutions) {
    const categoryId = assignments.get(s.id);
    // An assignment to a category that no longer exists falls back to
    // standalone rather than making the solution vanish.
    if (!categoryId || !known.has(categoryId)) {
      standalone.push(s);
      continue;
    }
    const bucket = grouped.get(categoryId);
    if (bucket) bucket.push(s);
    else grouped.set(categoryId, [s]);
  }

  const ordered = [...categories].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );

  const entries: SidebarEntry[] = [];
  for (const c of ordered) {
    const inside = grouped.get(c.id);
    if (!inside || inside.length === 0) continue;
    entries.push({
      kind: "category",
      category: { id: c.id, name: c.name, solutions: [...inside].sort(byName) },
    });
  }
  for (const s of [...standalone].sort(byName)) {
    entries.push({ kind: "solution", solution: s });
  }
  return entries;
}
```

- [ ] **Step 4: Run the test to verify that it passes**

Run: `rtk pnpm vitest run src/features/categories/lib/sidebar-entries.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add src/features/categories/lib/
rtk git commit -m "feat(categories): sidebar entry fold"
```

---

### Task 4: Rename the reorder helper for reuse

**Files:**
- Modify: `src/features/solutions-hub/lib/reorder.ts`
- Modify: `src/features/solutions-hub/lib/reorder.test.ts`
- Modify: `src/features/solutions-hub/server/router.ts` (the `resolveFavoriteReorder` import and its one call inside `reorderFavorites`)

**Interfaces:**
- Consumes: the existing `resolveFavoriteReorder(currentIds, requestedIds): string[]`.
- Produces: the same function named `resolveExplicitOrder(currentIds, requestedIds): string[]`. Task 5 reuses it for category order.

The logic is correct and already tested. Only the name changes, because categories need the same partition-reindex rule and the current name says "favorite".

- [ ] **Step 1: Rename the function and update its doc comment**

In `src/features/solutions-hub/lib/reorder.ts`, rename the exported function to `resolveExplicitOrder`. Replace the first line of its doc comment with:

```ts
/**
 * Apply a requested order to a subset of ids, keeping every id the request does
 * not name in its current relative position. Used by the favorites rail and by
 * the admin category order.
 */
```

- [ ] **Step 2: Update the test file**

In `src/features/solutions-hub/lib/reorder.test.ts`, change the import and the `describe` title to `resolveExplicitOrder`, and update all six call sites.

- [ ] **Step 3: Update the one production call site**

In `src/features/solutions-hub/server/router.ts`, change the import from `../lib/reorder` and the call inside `reorderFavorites` to `resolveExplicitOrder`.

- [ ] **Step 4: Run the tests and the type check**

Run: `rtk pnpm vitest run src/features/solutions-hub/lib/reorder.test.ts`
Expected: PASS, 6 tests.

Run: `rtk pnpm typecheck`
Expected: no errors. A missed call site shows up here.

- [ ] **Step 5: Commit**

```bash
rtk git add src/features/solutions-hub/
rtk git commit -m "refactor(hub): rename resolveFavoriteReorder to resolveExplicitOrder"
```

---

### Task 5: Category service

**Files:**
- Create: `src/features/categories/server/category-service.ts`

**Interfaces:**
- Consumes: `category` and `solutionCategory` from Task 1, `buildSidebarEntries` from Task 3, `resolveExplicitOrder` from Task 4, `listHubSolutions` from `@/features/solutions-hub/server/queries`, `AuthUser` from `@/server/authz`.
- Produces:
  - `listCategories(): Promise<CategorySummary[]>`
  - `createCategory(name: string): Promise<{ id: string }>`
  - `renameCategory(id: string, name: string): Promise<void>`
  - `deleteCategory(id: string): Promise<void>`
  - `reorderCategories(orderedIds: string[]): Promise<void>`
  - `assignCategory(solutionId: string, categoryId: string | null): Promise<void>`
  - `listSidebarEntries(user: AuthUser): Promise<SidebarEntry[]>`

- [ ] **Step 1: Write the service**

Create `src/features/categories/server/category-service.ts`:

```ts
import "server-only";

import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { category, solutionCategory } from "@/server/db/schema";
import type { AuthUser } from "@/server/authz";
import { resolveExplicitOrder } from "@/features/solutions-hub/lib/reorder";
import { listHubSolutions } from "@/features/solutions-hub/server/queries";

import { buildSidebarEntries } from "../lib/sidebar-entries";
import type { CategorySummary, SidebarEntry } from "../schemas/category";

/**
 * Category reads and writes. A category is presentation only: nothing here
 * touches `group_solution`, and the sidebar read below derives visibility from
 * the hub's existing access-gated query rather than from any category rule.
 */

export async function listCategories(): Promise<CategorySummary[]> {
  return db
    .select({
      id: category.id,
      name: category.name,
      position: category.position,
      solutionCount: sql<number>`count(${solutionCategory.solutionId})::int`,
    })
    .from(category)
    .leftJoin(solutionCategory, eq(solutionCategory.categoryId, category.id))
    .groupBy(category.id)
    .orderBy(asc(category.position), asc(category.name));
}

export async function createCategory(name: string): Promise<{ id: string }> {
  // Append: a new category lands last in the admin's order.
  const [row] = await db
    .insert(category)
    .values({
      name,
      position: sql<number>`coalesce((select max(${category.position}) from ${category}), -1) + 1`,
    })
    .returning({ id: category.id });
  return { id: row!.id };
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await db.update(category).set({ name, updatedAt: new Date() }).where(eq(category.id, id));
}

/**
 * Deleting a category cascades its `solution_category` rows, so its solutions
 * become standalone. A delete never removes a solution from the sidebar.
 */
export async function deleteCategory(id: string): Promise<void> {
  await db.delete(category).where(eq(category.id, id));
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: category.id })
      .from(category)
      .orderBy(asc(category.position), asc(category.name));
    const final = resolveExplicitOrder(
      current.map((c) => c.id),
      orderedIds,
    );
    if (final.length === 0) return;
    // One bulk UPDATE via unnest — the same shape as reorderFavorites, so two
    // concurrent reorders cannot deadlock on lock-order inversion.
    await tx.execute(sql`
      update ${category} as c
      set position = v.position
      from (
        select * from unnest(
          ${sql.param(final)}::uuid[],
          ${sql.param(final.map((_, index) => index))}::int[]
        ) as v(id, position)
      ) as v
      where c.id = v.id
    `);
  });
}

/**
 * One category per solution: the write is an upsert keyed on the solution id,
 * which the primary key enforces. `null` clears the row and returns the
 * solution to the standalone section.
 */
export async function assignCategory(
  solutionId: string,
  categoryId: string | null,
): Promise<void> {
  if (categoryId === null) {
    await db.delete(solutionCategory).where(eq(solutionCategory.solutionId, solutionId));
    return;
  }
  // Check the category first. Without this, assigning to a category another
  // admin just deleted raises a Postgres foreign-key violation (23503), which
  // reaches the admin screen as an opaque 500 instead of a clear message.
  const [target] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, categoryId))
    .limit(1);
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
  }
  await db
    .insert(solutionCategory)
    .values({ solutionId, categoryId })
    .onConflictDoUpdate({ target: solutionCategory.solutionId, set: { categoryId } });
}

/**
 * The customer sidebar. `listHubSolutions` already applies the access gate
 * (membership ∩ grant, minus archived, draft, and native), so this function
 * adds grouping only. It never widens or narrows what the user can reach.
 */
export async function listSidebarEntries(user: AuthUser): Promise<SidebarEntry[]> {
  const [solutions, categories, assignments] = await Promise.all([
    listHubSolutions(user, { sort: "name" }),
    db.select({ id: category.id, name: category.name, position: category.position }).from(category),
    db
      .select({
        solutionId: solutionCategory.solutionId,
        categoryId: solutionCategory.categoryId,
      })
      .from(solutionCategory),
  ]);
  return buildSidebarEntries(
    categories,
    solutions,
    new Map(assignments.map((a) => [a.solutionId, a.categoryId])),
  );
}
```

- [ ] **Step 2: Check the types**

Run: `rtk pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add src/features/categories/server/category-service.ts
rtk git commit -m "feat(categories): service reads and writes"
```

---

### Task 6: Category router

**Files:**
- Create: `src/features/categories/server/router.ts`
- Modify: `src/server/trpc/router.ts`

**Interfaces:**
- Consumes: every function from Task 5, the schemas from Task 2, `adminProcedure` and `protectedProcedure` from `@/server/trpc/init`.
- Produces: `categoriesRouter` with `list`, `create`, `rename`, `remove`, `reorder`, `assign`, and `sidebar`. Client code reaches it as `trpc.categories.*`.

- [ ] **Step 1: Write the router**

Create `src/features/categories/server/router.ts`:

```ts
import "server-only";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

import {
  assignCategorySchema,
  categoryIdSchema,
  createCategorySchema,
  renameCategorySchema,
  reorderCategoriesSchema,
} from "../schemas/category";
import * as categoryService from "./category-service";

/**
 * Category CRUD is admin-only. The one customer-facing procedure, `sidebar`,
 * is read-only and derives its visibility from the hub's access-gated query —
 * a category grants nothing on its own.
 */
export const categoriesRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    return categoryService.listCategories();
  }),

  create: adminProcedure.input(createCategorySchema).mutation(async ({ input }) => {
    return categoryService.createCategory(input.name);
  }),

  rename: adminProcedure.input(renameCategorySchema).mutation(async ({ input }) => {
    await categoryService.renameCategory(input.id, input.name);
    return { id: input.id };
  }),

  remove: adminProcedure.input(categoryIdSchema).mutation(async ({ input }) => {
    await categoryService.deleteCategory(input.id);
    return { id: input.id };
  }),

  reorder: adminProcedure.input(reorderCategoriesSchema).mutation(async ({ input }) => {
    await categoryService.reorderCategories(input.orderedIds);
    return { ok: true };
  }),

  assign: adminProcedure.input(assignCategorySchema).mutation(async ({ input }) => {
    await categoryService.assignCategory(input.solutionId, input.categoryId);
    return { solutionId: input.solutionId };
  }),

  /** The customer sidebar's categories and standalone solutions, in order. */
  sidebar: protectedProcedure.query(async ({ ctx }) => {
    return categoryService.listSidebarEntries(ctx.auth.user);
  }),
});
```

- [ ] **Step 2: Mount it on the app router**

In `src/server/trpc/router.ts`, add the import beside the other feature routers:

```ts
import { categoriesRouter } from "@/features/categories/server/router";
```

And add the entry to `appRouter`, after `chat`:

```ts
  categories: categoriesRouter,
```

- [ ] **Step 3: Check the types**

Run: `rtk pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
rtk git add src/features/categories/server/router.ts src/server/trpc/router.ts
rtk git commit -m "feat(categories): trpc router"
```

---

### Task 7: Client API wrappers

**Files:**
- Create: `src/features/categories/api/categories.ts`

**Interfaces:**
- Consumes: `trpc.categories.*` from Task 6.
- Produces: `useCategories()`, `useSidebarEntries()`, `useCreateCategory()`, `useRenameCategory()`, `useDeleteCategory()`, `useReorderCategories()`, `useAssignCategory()`.

- [ ] **Step 1: Write the wrappers**

Create `src/features/categories/api/categories.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/provider";

// Feature query/mutation wrappers — AGENTS.md folder contract, features/<domain>/api/.

type TRPC = ReturnType<typeof useTRPC>;

/** Any taxonomy write changes both the admin list and the customer rail. */
function invalidateCategoryViews(trpc: TRPC, queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries(trpc.categories.list.queryFilter()),
    queryClient.invalidateQueries(trpc.categories.sidebar.queryFilter()),
  ]);
}

export function useCategories() {
  const trpc = useTRPC();
  return useQuery(trpc.categories.list.queryOptions());
}

export function useSidebarEntries() {
  const trpc = useTRPC();
  return useQuery(trpc.categories.sidebar.queryOptions());
}

export function useCreateCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.create.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useRenameCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.rename.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useDeleteCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.remove.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useReorderCategories() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.reorder.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}

export function useAssignCategory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.categories.assign.mutationOptions({
      onSuccess: () => invalidateCategoryViews(trpc, queryClient),
    }),
  );
}
```

- [ ] **Step 2: Check the types**

Run: `rtk pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add src/features/categories/api/
rtk git commit -m "feat(categories): client query and mutation wrappers"
```

---

### Task 8: Collapse state in localStorage

**Files:**
- Create: `src/app/(workspace)/_lib/use-collapsed-categories.ts`
- Test: `src/app/(workspace)/_lib/use-collapsed-categories.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `COLLAPSED_KEY`, the pure helpers `parseCollapsed(raw: string | null): Set<string>` and `serialiseCollapsed(ids: Set<string>): string`, and the hook `useCollapsedCategories(): { isCollapsed(id: string): boolean; toggle(id: string): void }`.

The hook itself carries no unit test: the vitest environment is `node` and the include pattern only matches `*.test.ts`. The parse and serialise halves hold the only logic that can break, so they carry the tests.

- [ ] **Step 1: Write the failing test**

Create `src/app/(workspace)/_lib/use-collapsed-categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseCollapsed, serialiseCollapsed } from "./use-collapsed-categories";

describe("collapsed category storage", () => {
  it("returns an empty set when nothing is stored", () => {
    expect(parseCollapsed(null)).toEqual(new Set());
  });

  it("returns an empty set for malformed JSON instead of throwing", () => {
    expect(parseCollapsed("{oops")).toEqual(new Set());
  });

  it("returns an empty set when the stored value is not an array of strings", () => {
    expect(parseCollapsed('{"a":1}')).toEqual(new Set());
    expect(parseCollapsed("[1,2]")).toEqual(new Set());
  });

  it("round-trips a set of ids", () => {
    const ids = new Set(["cat-1", "cat-2"]);
    expect(parseCollapsed(serialiseCollapsed(ids))).toEqual(ids);
  });
});
```

- [ ] **Step 2: Run the test to verify that it fails**

Run: `rtk pnpm vitest run "src/app/(workspace)/_lib/use-collapsed-categories.test.ts"`
Expected: FAIL, because the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/app/(workspace)/_lib/use-collapsed-categories.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Which categories the user has collapsed. The category itself is admin-owned,
 * but the open-and-closed state belongs to the user, so it lives on the device.
 *
 * `localStorage` is the right fidelity here: this is a per-device preference,
 * not shared data. Moving it to the server later is one import.
 */
export const COLLAPSED_KEY = "genie.sidebar.collapsedCategories";

/** Tolerates every malformed value — a bad key must never break the sidebar. */
export function parseCollapsed(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    if (!parsed.every((id) => typeof id === "string")) return new Set();
    return new Set(parsed as string[]);
  } catch {
    return new Set();
  }
}

export function serialiseCollapsed(ids: Set<string>): string {
  return JSON.stringify([...ids]);
}

export function useCollapsedCategories() {
  // Start empty so the server render and the first client render agree; the
  // stored value arrives in the effect below. Every category starts expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCollapsed(parseCollapsed(window.localStorage.getItem(COLLAPSED_KEY)));
  }, []);

  // The write happens OUTSIDE the state updater. A `setState` updater must stay
  // pure: React can call it twice under StrictMode, or discard the render.
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(COLLAPSED_KEY, serialiseCollapsed(next));
      setCollapsed(next);
    },
    [collapsed],
  );

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed]);

  return { isCollapsed, toggle };
}
```

- [ ] **Step 4: Run the test to verify that it passes**

Run: `rtk pnpm vitest run "src/app/(workspace)/_lib/use-collapsed-categories.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add "src/app/(workspace)/_lib/"
rtk git commit -m "feat(workspace): persist sidebar collapse state per device"
```

---

### Task 9: Sidebar categories section

**Files:**
- Create: `src/app/(workspace)/_components/sidebar-categories.tsx`
- Modify: `src/app/(workspace)/_components/workspace-chrome.tsx` (the `sidebarInner` scrolling block, around lines 96–115)
- Modify: `src/app/(workspace)/layout.tsx` (add the prefetch beside the favorites one)
- Modify: `src/app/globals.css` (sticky nav and thin scrollbar)

**Interfaces:**
- Consumes: `useSidebarEntries()` from Task 7, `useCollapsedCategories()` from Task 8, `SidebarEntry` from Task 2.
- Produces: the `<SidebarCategories />` component, mounted under `<PinnedFavorites />`.

The reference rendering is the prototype, variant F, on branch `prototype/sidebar-groups`. Restore it with `git checkout prototype/sidebar-groups -- prototypes/` to see it.

- [ ] **Step 1: Write the component**

Create `src/app/(workspace)/_components/sidebar-categories.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CSSProperties } from "react";

import { useSidebarEntries } from "@/features/categories/api/categories";
import type { SidebarEntry } from "@/features/categories/schemas/category";

import { useCollapsedCategories } from "../_lib/use-collapsed-categories";

type CategoryEntry = Extract<SidebarEntry, { kind: "category" }>;
type SolutionEntry = Extract<SidebarEntry, { kind: "solution" }>;

// Explicit type predicates: a plain `.filter(e => e.kind === "category")` still
// returns SidebarEntry[], so `entry.category` below would not type-check.
const isCategoryEntry = (e: SidebarEntry): e is CategoryEntry => e.kind === "category";
const isSolutionEntry = (e: SidebarEntry): e is SolutionEntry => e.kind === "solution";

/**
 * Admin categories and standalone solutions, below the PINNED rail.
 *
 * A category name and a standalone solution name start at the same x position,
 * so the caret sits on the RIGHT. A caret on the left would indent every
 * category by one disclosure slot and break the column.
 *
 * The server decides what appears here: `categories.sidebar` returns only the
 * solutions this user is granted, and only the categories that hold at least
 * one of them. This component adds no filtering of its own.
 */
const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "8px 10px",
  fontSize: "var(--t-body)",
  cursor: "pointer",
  textAlign: "left",
  borderLeft: "3px solid transparent",
  color: "var(--ink2)",
};

function linkStyle(active: boolean): CSSProperties {
  return active
    ? {
        ...rowBase,
        background: "var(--brandtint)",
        borderLeftColor: "var(--brand)",
        color: "var(--brandink)",
        fontWeight: 700,
      }
    : rowBase;
}

const dividerStyle: CSSProperties = {
  height: 1,
  background: "var(--line2)",
  margin: "14px 6px 10px",
};

const clampStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export function SidebarCategories() {
  const pathname = usePathname();
  const { data } = useSidebarEntries();
  const { isCollapsed, toggle } = useCollapsedCategories();

  const entries = data ?? [];
  if (entries.length === 0) return null;

  const categories = entries.filter(isCategoryEntry);
  const standalone = entries.filter(isSolutionEntry);

  return (
    <div className="flex flex-col">
      <div style={dividerStyle} />

      {categories.map((entry) => {
        const c = entry.category;
        const collapsed = isCollapsed(c.id);
        return (
          <div key={c.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(c.id)}
              aria-expanded={!collapsed}
              style={{ ...rowBase, background: "none", borderTop: 0, borderRight: 0, borderBottom: 0 }}
            >
              <span style={{ ...clampStyle, flex: 1 }}>{c.name}</span>
              <span style={{ font: "600 var(--m-sm) var(--font-mono)", color: "var(--ink3)" }}>
                {c.solutions.length}
              </span>
              <span
                aria-hidden
                style={{
                  color: "var(--ink3)",
                  fontSize: "var(--m-sm)",
                  transition: "transform var(--dur-fast) var(--ease)",
                  transform: collapsed ? "rotate(-90deg)" : "none",
                }}
              >
                ▾
              </span>
            </button>

            {collapsed
              ? null
              : c.solutions.map((s) => {
                  const active = pathname === `/s/${s.slug}`;
                  return (
                    <Link
                      key={s.id}
                      href={`/s/${s.slug}`}
                      aria-current={active ? "page" : undefined}
                      style={{
                        ...linkStyle(active),
                        marginLeft: 10,
                        width: "calc(100% - 10px)",
                        fontSize: "var(--t-sm)",
                      }}
                    >
                      <span style={clampStyle}>{s.name}</span>
                    </Link>
                  );
                })}
          </div>
        );
      })}

      {standalone.length > 0 && categories.length > 0 ? <div style={dividerStyle} /> : null}

      {standalone.map((entry) => {
        const s = entry.solution;
        const active = pathname === `/s/${s.slug}`;
        return (
          <Link
            key={s.id}
            href={`/s/${s.slug}`}
            aria-current={active ? "page" : undefined}
            style={linkStyle(active)}
          >
            <span style={clampStyle}>{s.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the chrome, and make the nav sticky**

In `src/app/(workspace)/_components/workspace-chrome.tsx`, add the import:

```tsx
import { SidebarCategories } from "./sidebar-categories";
```

Replace the scrolling body block inside `sidebarInner` with the block below. The `WORKSPACE` label and the nav move into a sticky wrapper, so a long rail never scrolls the primary nav out of reach:

```tsx
      <div
        className="ws-rail"
        style={{ padding: "14px 12px", flex: 1, overflowY: "auto", minHeight: 0 }}
      >
        <div className="ws-navsticky">
          <div
            style={{
              font: "600 var(--m-sm) var(--font-mono)",
              letterSpacing: "0.13em",
              color: "var(--ink3)",
              padding: "0 6px 8px",
            }}
          >
            WORKSPACE
          </div>
          <WorkspaceNav />
        </div>
        <PinnedFavorites />
        <SidebarCategories />
      </div>
```

- [ ] **Step 3: Add the two CSS rules**

In `src/app/globals.css`, append to the workspace shell section, after the `.ws-burger` rules:

```css
/* The rail scrolls when categories overflow it. A thin, quiet scrollbar keeps
   the sidebar from gaining heavy chrome. */
.ws-rail {
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}
.ws-rail::-webkit-scrollbar {
  width: 8px;
}
.ws-rail::-webkit-scrollbar-track {
  background: transparent;
}
.ws-rail::-webkit-scrollbar-thumb {
  background: var(--line);
  border: 2px solid var(--sidebar);
}

/* The primary nav stays reachable at the top of a long rail. Negative margins
   pull the background to the rail edges while the rows keep their padding. */
.ws-navsticky {
  position: sticky;
  top: -14px;
  z-index: 5;
  background: var(--sidebar);
  margin: -14px -12px 4px;
  padding: 14px 12px 8px;
  border-bottom: 1px solid var(--line2);
}
```

- [ ] **Step 4: Prefetch the sidebar query**

In `src/app/(workspace)/layout.tsx`, add below the existing favorites prefetch:

```ts
  // SidebarCategories self-fetches; prefetch so the rail hydrates with no flash.
  prefetch(trpc.categories.sidebar.queryOptions());
```

- [ ] **Step 5: Build and check**

Run: `rtk pnpm typecheck && rtk pnpm lint && rtk pnpm build`
Expected: all three succeed.

- [ ] **Step 6: Commit**

```bash
rtk git add "src/app/(workspace)/" src/app/globals.css
rtk git commit -m "feat(workspace): render admin categories in the sidebar"
```

---

### Task 10: Admin categories screen

**Files:**
- Create: `src/features/categories/components/categories-directory.tsx`
- Create: `src/app/(admin)/admin/categories/page.tsx`
- Modify: `src/app/(admin)/_lib/admin-nav-items.ts`

**Interfaces:**
- Consumes: every hook from Task 7, plus the solutions list hook in `src/features/solutions/api/solutions.ts` for the assignment control.
- Produces: the `/admin/categories` route.

Read `src/features/groups/components/groups-directory.tsx` first and follow its structure: a header with a create control, then a list of rows with inline editing. Do not invent a new layout.

- [ ] **Step 1: Write the directory component**

Create `src/features/categories/components/categories-directory.tsx`. It must satisfy every line below:

- A text input and a button create a category. Both are `md` height, taken from `CONTROL_HEIGHTS`.
- Each row shows the name, the solution count, and controls to rename, move up, move down, and delete.
- Rename is inline. `Enter` commits and `Escape` cancels.
- Move up and move down call `useReorderCategories()` with every category id in the new order. Do not build drag-and-drop. The arrows work on touch, and the admin list is short.
- Delete needs a second, confirming click that names the category, then calls `useDeleteCategory()`. Put this copy beside the confirm control: `Solutions in this category move to the standalone list. None are removed.`
- A section below the list assigns solutions. For each solution, render a `Select` holding every category plus a `None` option, wired to `useAssignCategory()`. `None` sends `categoryId: null`.
- Show the count of solutions that hold no category, so the number itself creates pressure to file them.

- [ ] **Step 2: Write the route**

Create `src/app/(admin)/admin/categories/page.tsx`:

```tsx
import { CategoriesDirectory } from "@/features/categories/components/categories-directory";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// Admin: solution categories — thin route composing the feature slice.
export default function CategoriesPage() {
  prefetch(trpc.categories.list.queryOptions());
  return (
    <HydrateClient>
      <CategoriesDirectory />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Add the nav item**

In `src/app/(admin)/_lib/admin-nav-items.ts`, add an entry after Solutions. Match the exact shape of the entries already in that file:

```ts
  { href: "/admin/categories", label: "Categories", isActive: (p: string) => p.startsWith("/admin/categories") },
```

- [ ] **Step 4: Build and check**

Run: `rtk pnpm typecheck && rtk pnpm lint && rtk pnpm build`
Expected: all three succeed, and `/admin/categories` appears in the build's route list.

- [ ] **Step 5: Commit**

```bash
rtk git add src/features/categories/components/ "src/app/(admin)/"
rtk git commit -m "feat(admin): categories screen"
```

---

### Task 11: Full verification

**Files:** none, unless a check fails.

- [ ] **Step 1: Run every gate**

```bash
rtk pnpm test && rtk pnpm typecheck && rtk pnpm lint && rtk pnpm build
```

Expected: all four pass. Report the real output. If one fails, fix it before you continue.

- [ ] **Step 2: Check the behaviour by hand**

Start the app and sign in as an admin. Verify each line:

1. `/admin/categories` lists Financial, Healthcare, and Legal.
2. Assigning a solution to Financial makes Financial appear in the workspace sidebar.
3. Collapsing a category and reloading the page keeps it collapsed.
4. A solution set to `None` appears as a first-level row, below the categories.
5. Deleting a category moves its solutions to the standalone rows and removes none of them.
6. A user without a grant to any solution in a category does not see that category.

- [ ] **Step 3: Close the issue and push**

```bash
bd close genie-ops-center-t2k
rtk git pull --rebase
rtk git push
rtk git status
```

Expected: `git status` reports that the branch is up to date with its remote.

---

## Notes for the implementer

**The one thing that must not break.** A category must never widen access. Every solution the sidebar shows comes from `listHubSolutions`, which already applies membership ∩ grant. If you find yourself adding a category id to a query in `src/server/features/solution-access.ts`, or to `customerVisible` in `src/features/solutions-hub/server/queries.ts`, stop. That is the design error the spec exists to prevent.

**Why the primary key sits on `solution_id` alone.** It enforces one category per solution in the database rather than in application code. The product owner chose the simple model deliberately. Widening it later means changing that key and the admin control, with no data migration.

**Deliberately not built:** user-created categories, nested categories, drag-and-drop ordering for the admin, server-stored collapse state, and any change to favorites or pins.
