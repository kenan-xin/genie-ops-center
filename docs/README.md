# Genie Workspace — Documentation

This tree contains current operational guides and historical planning/design artifacts. Start with the [repository README](../README.md) for local setup and [deployment](./deployment.md) for runtime configuration. **Beads (`bd`) owns current work status and backlog**; ticket front matter and checkboxes in archived plans are snapshots, not the active tracker.

The tech plans and tickets describe intended behavior as well as implemented work. In particular, native apps and the Everyone/protected-admin model are still planned. Design prototypes remain the screen reference, subject to the epic brief's production deltas; `src/app/globals.css` and the implementation reference describe shipped tokens.

## Index

| Doc                                                                 | What it covers                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [epic-brief](./epic-brief/index.md)                                 | What Genie Workspace is, who it serves, scope, locked framing decisions              |
| [tech-plan](./tech-plan/index.md)                                   | Foundation architecture — auth/session/authz, app structure, ops                     |
| [tech-plan/data-model](./tech-plan/data-model/index.md)             | Drizzle schema (better-auth + domain tables)                                         |
| [tech-plan/chat](./tech-plan/chat/index.md)                         | External SSE → ai-sdk-ui chat mechanism (proxy, reasoning, conversation model)       |
| [external-chat-api-contract](./external-chat-api-contract/index.md) | The **observed** external Genie chat SSE contract (captured live)                    |
| [tickets](./tickets/index.md)                                       | Historical implementation breakdown + dependency graph; use Beads for status                                 |
| [execution-log](./execution-log/index.md)                           | Accepted deviations recorded during implementation                                   |
| [design-package](./design-package/index.md)                         | "Ledger" design system (tokens + recipes) **+ the interactive prototype (`.dc.html`) — screen source of truth** |
| [design-package/design-system/implementation](./design-package/design-system/implementation.md) | **Living implementation reference** — shipped tokens (`globals.css`) + the React component kit with real props/variants |
| [deployment](./deployment.md)                                       | Planned Coolify topology, separate PostgreSQL, env contract, image health check and Compose examples |
| [foundation-walkthrough.html](./foundation-walkthrough.html)        | Historical foundation walkthrough; not a current feature inventory                     |
| [native-apps](./native-apps/index.md) | Planned native module guide; not executable against the current repo |
| [superpowers](./superpowers/README.md) | Historical dated design specs and implementation plans |

## Historical artifact provenance

- **Design package screenshots + designer tooling** — the ~140 screenshots (≈3.7 MB binaries), `CLAUDE.md`, `support.js`, and `uploads/` stay in the Traycer artifacts. The interactive prototype `.dc.html` files **are now mirrored** into `design-package/` (they're the screen source of truth, and keeping them out is what let the UI drift from the design).
- **Critique / review artifacts** — review history. Earlier planning reviews informed the tech plan; current review follow-ups are tracked in Beads.
