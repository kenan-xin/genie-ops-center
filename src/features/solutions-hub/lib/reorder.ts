/**
 * Apply a requested order to a subset of ids, keeping every id the request does
 * not name in its current relative position. Used by the favorites rail and by
 * the admin category order.
 */
export function resolveExplicitOrder(currentIds: string[], requestedOrder: string[]): string[] {
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
