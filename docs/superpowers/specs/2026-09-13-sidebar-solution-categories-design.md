# Sidebar solution categories — design

Date: 2026-09-13
Status: approved, not implemented
Prototype: `prototypes/sidebar-groups.prototype.html`, variant F (throwaway branch `prototype/sidebar-groups`)

## Problem

The workspace sidebar shows a flat `PINNED` rail of up to six favorites. A user
who holds more solutions than that has no structure in the sidebar. The rail
cannot compress, so the number of visible rows is the hard limit.

A collapsed category costs one row and holds many solutions. Categories change
the sidebar limit from "six favorites" to "as many categories as fit".

## Naming — read this first

The database already uses the word `group`. The `group` table is the access
unit: `group_member` puts a user in a group, and `group_solution` grants that
group a solution. This is the only access grant in the system.

The new concept is called a **category**. A category is presentation only. It
never grants or removes access. Do not name it a group, and do not add it to
the access path.

## Model

A category is an admin-owned label with a name and a position. An admin puts
solutions in it. A user cannot create, rename, reorder, or delete a category.

A solution belongs to at most one category.

A solution with no category is not an error. It renders as a first-level row in
the sidebar, below all categories. "No category" means "this solution stands
alone".

The system seeds three categories: Financial, Healthcare, and Legal. They are
ordinary rows. An admin can rename or delete them. They start empty.

## Visibility

A category carries no permissions. Visibility derives from the existing grant
path:

    user → group_member → group_solution → solution

Rules:

1. A solution appears in the sidebar if the user holds a grant to it.
2. A category appears if at least one solution inside it is visible to the user.
3. A category with no visible solutions does not render. An empty category and
   a category the user cannot reach look the same: absent.

This removes a whole failure class. Two permission rules cannot disagree,
because there is only one.

## Schema

Two new tables in `src/server/db/schema.ts`.

```ts
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
    // One row per solution TODAY. The primary key is on solution_id alone, so
    // the single-category rule is enforced by the database, not by convention.
    // Widening to many-to-many later means changing this key — no backfill and
    // no data migration.
    primaryKey({ columns: [t.solutionId] }),
    index("solution_category_category_id_idx").on(t.categoryId),
  ],
);
```

A join table is used even though the relation is one-to-one today. The admin UI
stays a single select. If the product later needs a solution in two categories,
the change is the primary key plus the UI. No column moves and no rows are
rewritten.

Deleting a category cascades the join rows. Its solutions become standalone.
They never disappear from the sidebar.

## Sidebar rendering

Order in the rail, top to bottom:

1. `WORKSPACE` label and the primary nav. This block is sticky at the top of
   the scroll area.
2. `PINNED` — the existing favorites rail, unchanged.
3. A hairline rule.
4. Categories, in admin `position` order. Each is a collapsible first-level row
   with the name on the left, the visible count and a caret on the right.
5. A hairline rule.
6. Standalone solutions, as first-level rows. No caret and no count.

A category name and a standalone solution name start at the same x position. In
the prototype the caret sits on the right for this reason. A caret on the left
would indent every category by one step and break the column.

The rail scrolls when it overflows. The scrollbar is thin and uses `--line`.
The GENIE header and the user footer stay fixed outside the scroll area.

A solution can appear twice: once in `PINNED` and once in its category. This is
expected. Favorites are the personal layer and categories are the taxonomy.

## Collapse state

Collapse is the user's, even though the category is not. Store it in
`localStorage` under one key, as a map of category id to boolean.

Do not build a server API for it. This is a per-device preference. Moving it to
the server later is one import.

All categories start expanded. The rail does not behave as an accordion.

## Admin console

One new screen: categories.

- Create a category with a name.
- Rename a category.
- Reorder categories by drag, writing `position`.
- Delete a category, after a confirming step that names it.
- Assign a solution to a category with one select. The control offers every
  category plus "None".
- Show the count of solutions that have no category, so the number itself
  creates pressure to file them.

There is no screen that assigns a category to a `group`. That screen was
considered and cancelled. It would create a second source of truth beside
`group_solution`.

## Out of scope

- User-created categories. Users cannot make their own.
- Any change to favorites, pins, or the six-item rail cap.
- Nested categories.
- Interleaving standalone solutions between categories.
- Server-stored collapse state.

## Testing

- Visibility: a user with a grant to one solution in a category sees the
  category. A user with no grant inside it does not.
- An empty category never renders for a user.
- Deleting a category moves its solutions to the standalone section and removes
  none of them.
- A solution cannot hold two categories. The primary key rejects the second.
- Collapse state survives a reload and does not leak between users on a shared
  device beyond what `localStorage` already implies.
- The rail scrolls at 100 solutions, and the sticky nav stays visible.

## Signals that this model is wrong

Watch for these after release. Each one argues for many-to-many categories:

1. The standalone section grows to rival the categorised rows. The rail is a
   flat list again.
2. Admins invent a category only to hold solutions that fit two.
3. Users ask why a solution is not under a category they expected.

## Decision record

Design settled 2026-09-13 in a prototype session, with a second opinion from a
separate model on six questions. Accepted from it:

- Visibility derives from grants and never sits on the category. This reversed
  the original plan to assign a category to a user group.
- Empty categories hide from users.
- Collapse state lives in `localStorage`.
- One category per solution, over a join table, was accepted after review.

Two details changed when the plan met the code. Both are deliberate:

- Collapse state is stored as an array of collapsed category ids, not a map of
  id to boolean. Absence means expanded, so the map would carry only `false`
  values for every category the user never touched.
- The admin reorders categories with up and down controls, not by dragging.
  The list is short, and the controls work on touch.

Rejected from the second opinion: an "Uncategorised" bucket. Standalone first-level rows serve
the same need and treat "no category" as a deliberate choice.
