<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Genie Ops Center — conventions

Next.js 16 (app router) · shadcn-on-Base UI · Tailwind v4 · tRPC + TanStack Query · Drizzle/Postgres · Ledger design system. Code is organised by feature; UI primitives live in `src/components/ui`.

## State

| Kind                      | Use                                                        | Notes                                                                                   |
| ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Server / cache state      | **TanStack Query** via tRPC (`@trpc/tanstack-react-query`) | `ReactQueryDevtools` is wired in `src/trpc/provider.tsx`, dev-only.                     |
| Complex client / UI state | **Zustand**                                                | Wrap every store in the `devtools` middleware (dev-only) so it shows in Redux DevTools. |
| Trivial local state       | `useState`                                                 | Don't reach for Zustand here, and never use Zustand for server data — Query owns that.  |

Zustand store pattern:

```ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useExampleStore = create<ExampleState>()(
  devtools((set) => ({ open: false, setOpen: (open) => set({ open }) }), {
    name: "example",
    enabled: process.env.NODE_ENV !== "production",
  }),
);
```

## Forms

**react-hook-form + `zodResolver`**, sharing the same zod schemas the server validates with.

- **Native controls** (`Input`) bind directly: `<Input {...register("email")} />` — `ref`/`name`/`value`/`onChange`/`onBlur` forward to the underlying `<input>`.
- **Custom Base UI controls** (`Select`, `Switch`) bind via `<Controller>`:

```tsx
<Controller
  control={control}
  name="sort"
  render={({ field }) => (
    <Select items={items} value={field.value} onValueChange={field.onChange} />
  )}
/>

<Controller
  control={control}
  name="enabled"
  render={({ field }) => (
    <Switch checked={field.value} onCheckedChange={field.onChange} name={field.name} />
  )}
/>
```

## Design system

Ledger tokens are the source of truth in `src/app/globals.css`. **Never hard-code a px font size** — use the `text-display … text-mono-lg` utilities (mapped to the responsive `--t-*`/`--m-*` tokens). Square corners (radius 0–3px; pill only on `Switch`), hairline keylines over shadows, brand blue for primary/selection only. Motion is `.15–.22s` and is disabled under `prefers-reduced-motion` (global reset in `globals.css`).

**Screens: the prototype is the source of truth — open it before you build.** The tokens above are the _how_ (color/type/spacing); the prototype is the _what_ (layout, information architecture, exact copy, per-screen component composition). Before implementing **or reviewing** any screen, open `docs/design-package/Genie Control Station.dc.html` (and `docs/design-package/Genie Style Guide.dc.html` for component recipes) — it's one self-contained HTML doc, so grep it by the screen's heading/copy — and lift the exact structure, copy, and values. Skipping this is what caused the screen-level drift the design audit catalogued (e.g. login shipping "Welcome back" instead of the design's "Sign in / Continue / Administrator sign-in"). Honor the epic-brief **"Prototype → production deltas"**: production intentionally differs (naming "Genie Workspace"/"Solutions", no MFA, real data/persistence) — match the design on everything else.

## Code organization & folder structure

**North star:** app router by surface, features by domain, shared UI by abstraction, server by infrastructure. Adopted as a boundary/convention now; the `src/features/*` tree is grown **in time, per ticket**, not pre-created empty.

**Folder contract:**

| Folder            | Holds                                                                                              | Rule                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/app`         | Routing, layouts, page orchestration, route handlers only                                          | Keep thin — no business logic here. Compose features; don't implement them.       |
| `src/app/**/_components`, `_lib` | Route-local UI / helpers (one route subtree only)                                     | Use consistently across `(auth)`, `(workspace)`, `(admin)`.                       |
| `src/features/*`  | A domain's UI + hooks + schemas + server logic + API/query wrappers, co-located                    | Create the folder **when a ticket first builds that domain's full slice** (not empty/ahead). |
| `src/components/ui` | Design-system **primitives only** (`Button`, `Input`, `Dialog`, `Toast`, `Table`, `Switch`, …)   | Never put feature-aware components here. If it knows about users/solutions/admin, it's a feature component. |
| `src/server`      | Cross-cutting **server infrastructure** only (`auth.ts`, `authz.ts`, `config.ts`, `db/`, `trpc` core, root router) | Domain server logic lives in `features/*/server/`, not here.                     |
| `src/lib`         | Small shared helpers, intentionally — **not a junk drawer**                                        | Must be genuinely cross-cutting (e.g. the client-safe `password-strength` rule).  |
| `src/trpc`        | The client provider (TanStack Query + devtools)                                                    | Feature query/mutation wrappers live in `features/*/api/`.                        |

**Import direction (enforced by convention; add an oxlint `no-restricted-imports` rule if drift appears):**

```
components/ui · lib · types   →  usable everywhere
features/*                    →  may import shared (ui/lib/types) + server infra
app/*                         →  may import features + shared
features/*                    →  must NOT freely import sibling features (only via a documented seam)
server/*                      →  no React/client imports
```

**Where things correctly live (don't relocate prematurely):**

- `src/server/auth.ts`, `src/server/authz.ts` — cross-cutting infra (the session accessor + guards every surface uses), **not** an `auth` feature. Stay in `server/`.
- `src/lib/password-strength.ts` — client-safe shared policy used by both the server plugin and the UI meter. Stays in `lib/` (not `features/auth/`).
- `src/server/features/*` (e.g. `user-service.ts`, `solution-access.ts`) — server-only domain services. Move into `features/<domain>/server/` **when the ticket that wires them into real procedures/UI lands** (first move: `user-service.ts` → `features/users/server/` at ticket 06). Don't move ahead of that — path churn with no caller benefit.

**The one-line test before moving or adding a file:** does a real, current caller in a different layer need it co-located? If not, leave it where it is.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
