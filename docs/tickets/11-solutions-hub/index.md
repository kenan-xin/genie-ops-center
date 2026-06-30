---
kind: ticket
title: "11 · Solutions hub + Recent/Favorites"
status: 0
---

# 11 · Solutions hub + Recent/Favorites

The access-gated catalogue and the Recent/Favorites views (FR-HUB).

## Scope — in

- **Access-gated list** (FR-HUB-01): only solutions granted via the user's groups; archived hidden; `draft` hidden from customers; empty state when none.
- **Live name search** (FR-HUB-02), **type filter** All/Chat/Native/Embedded (FR-HUB-03), **sort** Recent/Name/Status (FR-HUB-04).
- **Progressive loading** (FR-HUB-05): start 5, extend by 4 via "load more" + auto on scroll-near-bottom; "N OF M SHOWN" counter. **Clear filters** (FR-HUB-06).
- **Solution row** (FR-HUB-07): monogram, name, description, type label, colour-coded status badge; openable only when not Draft; non-openable dimmed. **Favorites** star toggles from the row without opening (FR-HUB-08).
- **Recent & Favorites views** (FR-HUB-09): opening records to recent (most-recent first, cap 6; up to 4 surfaced on hub); dedicated Recent/Favorites pages.

## Scope — out

- The viewer itself (ticket 12). Recording "opened" happens on viewer open (ticket 12), surfaced here.

## Governs

[tech-plan](../../tech-plan/index.md) (see/run guards, recents/favorites filtering), [data-model](../../tech-plan/data-model/index.md).

## Depends on

[10 · Workspace shell & chrome](../10-workspace-shell/index.md). Meaningful with solutions from [08](../08-admin-solutions/index.md) and grants from [07](../07-admin-groups-access/index.md).

## Acceptance / guardrails (critique invariant)

- The hub, **Recent, and Favorites** all filter through the _same_ `assertCanSee` predicate (granted + unarchived + customer-visible) — a revoked/archived/drafted solution disappears immediately. Stored `favorite`/`recent` rows are a cache, not the access source.
