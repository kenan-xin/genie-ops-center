import "server-only";

import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { favorite, groupMember, groupSolution, recent, solution } from "@/server/db/schema";
import type { AuthUser } from "@/server/authz";
import { requiresSolutionGrant } from "@/server/features/solution-access";

/**
 * Access-gated solution catalogue (FR-HUB). Hub, Recent, and Favorites all
 * funnel through the same authorized + unarchived + customer-visible predicate
 * (the critique invariant): the stored `favorite`/`recent` rows are a cache, not
 * the access source, so a revoked/archived/drafted solution drops from every
 * list immediately. `draft` is hidden from customers; `native` is hidden from
 * the catalogue (enum-only, deferred runtime). `config` never leaves these
 * queries — only {@link SOLUTION_VIEW_COLUMNS}.
 */

/** A solution as the customer hub sees it (no config — that's runtime-only). */
export type HubSolution = {
  id: string;
  name: string;
  slug: string;
  type: "chat" | "native" | "embedded";
  status: "ready" | "draft" | "maintenance" | "down";
  description: string | null;
  monogram: string | null;
  accentColor: string | null;
  accentColorInvert: string | null;
  /** Whether the signed-in user has starred this solution. */
  isFavorite: boolean;
  /** RFC3339 of the last open, for the "recent" sort + the UPDATED column. null = never. */
  lastOpenedAt: string | null;
  updatedAt: string;
};

const VIEW = {
  id: solution.id,
  name: solution.name,
  slug: solution.slug,
  type: solution.type,
  status: solution.status,
  description: solution.description,
  monogram: solution.monogram,
  accentColor: solution.accentColor,
  accentColorInvert: solution.accentColorInvert,
  archived: solution.archived,
  updatedAt: solution.updatedAt,
} as const;

/**
 * The granted + unarchived + customer-visible predicate as a drizzle `where`.
 * Drafts are never openable/visible to customers (assertCanSee drops them);
 * native rows are hidden from the catalogue (deferred runtime). Members need
 * a group grant; administrators bypass that condition. Reused by hub, recent,
 * and favorites so all three share one access truth.
 */
function customerVisible(user: AuthUser) {
  const conditions = [
    eq(solution.archived, false),
    sql`${solution.status} <> 'draft'`,
    sql`${solution.type} <> 'native'`,
  ];

  if (requiresSolutionGrant(user)) {
    conditions.push(
      exists(
        db
          .select()
          .from(groupSolution)
          .where(
            and(
              eq(groupSolution.solutionId, solution.id),
              exists(
                db
                  .select()
                  .from(groupMember)
                  .where(
                    and(
                      eq(groupMember.groupId, groupSolution.groupId),
                      eq(groupMember.userId, user.id),
                    ),
                  ),
              ),
            ),
          ),
      ),
    );
  }

  return and(...conditions);
}

/** Allowed catalogue types (native is enum-only — never surfaced). */
export type HubTypeFilter = "all" | "chat" | "embedded";
export type HubSort = "recent" | "name" | "status";

function applyFilter(
  conditions: ReturnType<typeof and>,
  opts: { search?: string; type?: HubTypeFilter },
) {
  const out = [conditions];
  const term = opts.search?.trim();
  if (term) {
    out.push(or(ilike(solution.name, `%${term}%`), ilike(solution.description, `%${term}%`))!);
  }
  if (opts.type && opts.type !== "all") {
    out.push(eq(solution.type, opts.type));
  }
  return and(...out);
}

/** The columns `toHubSolution` reads — the hub never touches config/runtime fields. */
type HubRow = Pick<
  typeof solution.$inferSelect,
  | "id"
  | "name"
  | "slug"
  | "type"
  | "status"
  | "description"
  | "monogram"
  | "accentColor"
  | "accentColorInvert"
  | "updatedAt"
>;

function toHubSolution(row: HubRow, isFavorite: boolean, lastOpenedAt: Date | null): HubSolution {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type as HubSolution["type"],
    status: row.status,
    description: row.description,
    monogram: row.monogram,
    accentColor: row.accentColor,
    accentColorInvert: row.accentColorInvert,
    isFavorite,
    lastOpenedAt: lastOpenedAt ? lastOpenedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Resolved favorite set + last-open times for a user, to decorate list rows. */
async function userDecoration(
  user: AuthUser,
  solutionIds: string[],
): Promise<{
  favorites: Set<string>;
  lastOpened: Map<string, Date>;
}> {
  if (solutionIds.length === 0) {
    return { favorites: new Set(), lastOpened: new Map() };
  }
  const [favRows, recentRows] = await Promise.all([
    db
      .select({ solutionId: favorite.solutionId })
      .from(favorite)
      .where(and(eq(favorite.userId, user.id), inArray(favorite.solutionId, solutionIds))),
    db
      .select({ solutionId: recent.solutionId, openedAt: recent.openedAt })
      .from(recent)
      .where(and(eq(recent.userId, user.id), inArray(recent.solutionId, solutionIds))),
  ]);
  return {
    favorites: new Set(favRows.map((r) => r.solutionId)),
    lastOpened: new Map(recentRows.map((r) => [r.solutionId, r.openedAt])),
  };
}

function sortRows(rows: HubSolution[], sort: HubSort): HubSolution[] {
  if (sort === "name") {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "status") {
    // Stable-ish by severity then name (matches the admin directory's rule).
    const w: Record<HubSolution["status"], number> = {
      down: 0,
      maintenance: 1,
      ready: 2,
      draft: 3,
    };
    return [...rows].sort(
      (a, b) => (w[a.status] ?? 9) - (w[b.status] ?? 9) || a.name.localeCompare(b.name),
    );
  }
  // "recent": most-recently-opened first, then by last-updated as a tiebreak.
  return [...rows].sort((a, b) =>
    (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt),
  );
}

/**
 * The full granted set for the hub catalogue, already filtered/sorted/decorated.
 * Progressive loading is client-side over this array (the customer's reachable
 * solution count is small), so the procedure returns everything and the hub
 * slices — keeping the "N OF M SHOWN" counter and the side-rail recents in sync
 * without a second round-trip.
 */
export async function listHubSolutions(
  user: AuthUser,
  opts: { search?: string; type?: HubTypeFilter; sort?: HubSort } = {},
): Promise<HubSolution[]> {
  const rows = await db
    .select(VIEW)
    .from(solution)
    .where(
      applyFilter(customerVisible(user), {
        search: opts.search,
        type: opts.type,
      }),
    );

  const { favorites, lastOpened } = await userDecoration(
    user,
    rows.map((r) => r.id),
  );
  const items = rows.map((r) =>
    toHubSolution(r, favorites.has(r.id), lastOpened.get(r.id) ?? null),
  );
  return sortRows(items, opts.sort ?? "recent");
}

/** The user's recents, most-recent first, capped at 6, access-gated. */
export async function listRecentSolutions(user: AuthUser): Promise<HubSolution[]> {
  // Join recent → solution through the same customer-visible predicate, so a
  // revoked/archived/drafted solution vanishes from recents instantly. The
  // stored row stays (it's a cache) but no longer renders.
  const rows = await db
    .select({
      ...VIEW,
      openedAt: recent.openedAt,
    })
    .from(recent)
    .innerJoin(solution, eq(recent.solutionId, solution.id))
    .where(and(eq(recent.userId, user.id), customerVisible(user)))
    .orderBy(desc(recent.openedAt))
    .limit(6);

  const { favorites } = await userDecoration(
    user,
    rows.map((r) => r.id),
  );
  // Recents sort by openedAt (the query already orders), but lastOpenedAt drives
  // the UPDATED column display and the hub "recent" tiebreak.
  return rows.map((r) => toHubSolution(r, favorites.has(r.id), r.openedAt));
}

/**
 * The user's favorites, access-gated, ordered by the user's arrangement
 * (`position` ASC) then the existing recency tiebreak. Legacy rows default to
 * `position = 0` and tie at the top, falling back to recency until the user
 * first drags — no data migration needed (design spec §5.1).
 */
export async function listFavoriteSolutions(user: AuthUser): Promise<HubSolution[]> {
  const rows = await db
    .select({ ...VIEW, position: favorite.position })
    .from(favorite)
    .innerJoin(solution, eq(favorite.solutionId, solution.id))
    .where(and(eq(favorite.userId, user.id), customerVisible(user)));

  const { lastOpened } = await userDecoration(
    user,
    rows.map((r) => r.id),
  );
  const pairs = rows.map((r) => ({
    item: toHubSolution(r, true, lastOpened.get(r.id) ?? null),
    position: r.position,
  }));
  pairs.sort(
    (a, b) =>
      a.position - b.position ||
      (b.item.lastOpenedAt ?? b.item.updatedAt).localeCompare(
        a.item.lastOpenedAt ?? a.item.updatedAt,
      ),
  );
  return pairs.map((p) => p.item);
}
