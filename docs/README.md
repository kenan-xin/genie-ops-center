# Genie Workspace — Documentation

In-repo mirror of the planning artifacts. Planning happens in Traycer; this `/docs` tree is the snapshot synced into the repo at milestones so the design lives alongside the code. When the plan changes in Traycer, re-sync this folder.

## Index

| Doc                                                                 | What it covers                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [epic-brief](./epic-brief/index.md)                                 | What Genie Workspace is, who it serves, scope, locked framing decisions              |
| [tech-plan](./tech-plan/index.md)                                   | Foundation architecture — auth/session/authz, app structure, ops                     |
| [tech-plan/data-model](./tech-plan/data-model/index.md)             | Drizzle schema (better-auth + domain tables)                                         |
| [tech-plan/chat](./tech-plan/chat/index.md)                         | External SSE → ai-sdk-ui chat mechanism (proxy, reasoning, conversation model)       |
| [external-chat-api-contract](./external-chat-api-contract/index.md) | The **observed** external Genie chat SSE contract (captured live)                    |
| [tickets](./tickets/index.md)                                       | Implementation breakdown + dependency graph + status                                 |
| [execution-log](./execution-log/index.md)                           | Accepted deviations recorded during implementation                                   |
| [design-package](./design-package/index.md)                         | "Ledger" design system — tokens + recipes                                            |
| [deployment](./deployment.md)                                       | Production topology — app image + **external** Postgres, env contract, compose files |

## Not mirrored here

- **Design package binaries** — the prototype `.dc.html` files and ~140 screenshots (≈3.7 MB) stay in the Traycer artifacts; only the design-system tokens/recipes are mirrored (they're what the code consumes).
- **Critique / review artifacts** — review history. Their conclusions are already folded into the tech plan, so they're not duplicated here.
