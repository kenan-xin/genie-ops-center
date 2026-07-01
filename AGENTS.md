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
