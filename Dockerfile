# syntax=docker/dockerfile:1
# Multi-stage build for the single configurable Genie Workspace image (ticket 03b).
# node:24 (LTS, matches .nvmrc/engines). output: 'standalone' → a minimal
# server.js; we layer our migration/bootstrap entrypoint on top.

# ─── deps ────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# pnpm via corepack (matches packageManager → pnpm@11.9.0).
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Frozen lockfile, no lifecycle scripts (no .git in context; prepare's
# simple-git-hooks would no-op anyway). Installs prod + dev — dev needed for the
# build step (drizzle-kit, esbuild, typescript, tailwind).
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ─── build ───────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build evaluates server modules to collect page data, so the env it reads
# at build must be present. These are throwaway PLACEHOLDERS — they are not
# baked (verified: standalone reads process.env at runtime). Real secrets come
# from runtime env only.
ENV DATABASE_URL="postgres://build:build@build:5432/build" \
    BETTER_AUTH_SECRET="build-placeholder-not-used-at-runtime-xxxxxxxxxxxx" \
    BETTER_AUTH_URL="http://localhost:3000"

RUN mkdir -p public && pnpm build && pnpm build:entrypoint

# ─── runner ──────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

RUN chown -R node:node /app

# Standalone Next server (traced node_modules baked in by output: 'standalone' —
# includes pg, which the entrypoint bundle imports as external).
COPY --chown=node:node --from=build /app/.next/standalone ./
# standalone excludes public + static by design — copy them so server.js serves them.
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public

# Migration artifacts + the bundled entrypoint (config → lock → migrate → bootstrap).
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node --from=build /app/dist/entrypoint.mjs ./entrypoint.mjs

USER node
EXPOSE 3000

# Allow the 120s migration-lock wait plus migration/bootstrap time.
HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health', { redirect: 'error' }).then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"]

# `--conditions react-server` makes the `server-only` marker resolve to its
# empty impl inside the bundled server graph.
CMD ["node", "--conditions", "react-server", "entrypoint.mjs"]
