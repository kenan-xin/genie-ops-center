/**
 * Pure partition/reindex logic for `reorderFavorites` (design spec §5.3),
 * extracted so it can be unit-tested without a DB. `requestedOrder` may
 * contain unknown ids (dropped) and duplicates (de-duplicated); any id from
 * `currentIds` missing from the request is appended, preserving its current
 * relative order.
 */
export function resolveFavoriteReorder(currentIds: string[], requestedOrder: string[]): string[] {
  const currentSet = new Set(currentIds);
  const provided: string[] = [];
  const providedSet = new Set<string>();
  for (const id of requestedOrder) {
    if (currentSet.has(id) && !providedSet.has(id)) {
      provided.push(id);
      providedSet.add(id);
    }
  }
  const rest = currentIds.filter((id) => !providedSet.has(id));
  return [...provided, ...rest];
}
