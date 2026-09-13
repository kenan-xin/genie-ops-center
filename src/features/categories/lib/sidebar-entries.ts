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
