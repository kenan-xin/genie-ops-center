---
kind: ticket
title: "24c · Native catalogue, sync & admin surface"
status: 0
---

# 24c · Native catalogue, sync & admin surface

Makes native solutions discoverable (hub), seedable (sync script), and safely visible in admin. Depends on the Everyone group from ticket 25.

Governs: [tech-plan/native-solutions](../../../tech-plan/native-solutions/index.md).

## Scope — in

- **Catalogue un-hide:** remove the `${solution.type} <> 'native'` filter from `customerVisible` (`queries.ts:61`); widen `HubTypeFilter` (`queries.ts:87`) + add the `{ value: "native", label: "Native" }` chip to `TYPE_FILTERS` (`solutions-hub.tsx:34`); fix the stale comment at `solution-access.ts:74-82`.
- **Sync script `scripts/sync-native-solutions.ts`:** upsert native `solution` rows from `manifest.ts` (idempotent by unique `slug`); grant to the Everyone group **on first creation** only; **declarative archive reconcile** — a row whose `routeKey` left the manifest → `archived = true` (not deleted); drift-guard warnings (manifest↔registry↔DB mismatch).
- **Admin read-only native:** keep native in `solutions.list`; **reject `type === "native"` server-side** in `update`/`duplicate`/`setStatus`/`remove`; add the `native` key to `TYPE_LABEL` / `TYPE_LABEL_UPPER` + a "code-owned" lock affordance on the row. Native stays present + grantable on the Access screen.

## Scope — out

- The module system (24a); the viewer runtime (24b).

## Depends on

- [24b · Viewer runtime](../24b-viewer-runtime/index.md) (native must be openable before it's surfaced), [25 · Platform identity](../../25-platform-identity/index.md) (Everyone grant target), [11 · Solutions hub](../../11-solutions-hub/index.md).

## Acceptance / guardrails (critique findings)

- **F3 — no admin native creation:** `duplicate` / `update` / `setStatus` / `remove` reject native **at the tRPC boundary** (not just hidden buttons — a hidden button is not a barrier); the register dialog stays `chat | embedded`.
- **F6 — deterministic removal:** dropping an app's manifest entry + re-running sync **archives** its row (reversible, no `group_solution`/`favorite`/`recent` cascade); the app's actual data is gone via `DROP SCHEMA` (24a).
- Hub / recents / favorites include native via the single `customerVisible` predicate; the type chip renders (`typeLabel` → "NATIVE").
- Everyone-granted native is reachable by all users by default, but the grant stays admin-editable (per-group re-scoping).
