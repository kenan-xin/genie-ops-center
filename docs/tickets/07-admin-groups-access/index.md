---
kind: ticket
title: "07 · Admin: Groups, Access & Overview"
status: 0
---

# 07 · Admin: Groups, Access & Overview

Groups are the single access mechanism (FR-ADM-G), plus the access-overview explorer (FR-ADM-O).

## Scope — in

- **Group list** (FR-ADM-G-01): name, solution count, member count; search; select → inspector.
- **Create / rename / delete** (FR-ADM-G-02): description; delete confirms and notes members retain access only via other groups.
- **Group inspector** (FR-ADM-G-03): toggle individual solutions and members in/out; grant-all / clear-all and add-all / remove-all (destructive bulk confirms); per-list search.
- **Solution-access transfer list** (FR-ADM-G-04) and **membership transfer list** (FR-ADM-G-05): the shared dual-list (Available ⇄ Granted/Members) from ticket 02 — multi-select, select-all, grant/revoke, add-all/remove-all (confirm), per-side search. Writes `group_solution` / `group_member`.
- **Access Overview explorer** (FR-ADM-O-01): _By solution_ (which groups grant it → which people it reaches) and _By person_ (their groups → resulting solutions, annotated by granting group); shortcuts into the relevant group.

## Scope — out

- Solution registration/config (ticket 08). People CRUD (ticket 06).

## Governs

[tech-plan](../../tech-plan/index.md) (Access model), [data-model](../../tech-plan/data-model/index.md) (`group`, `group_member`, `group_solution`).

## Depends on

[06 · Admin: People](../06-admin-people/index.md) (people exist to assign; reuses the kit's dual-list).

## Acceptance / guardrails

- Access is granted to **groups only** — no per-user solution grants anywhere.
- Reachable-solutions = the union query through `group_member`→`group`→`group_solution`; the overview explorer reads the same query (one source of truth).
