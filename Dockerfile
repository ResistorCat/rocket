# ──────────────────────────────────────────────
# Stage 1: deps — install monorepo dependencies
# ──────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock* bunfig.toml ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# ──────────────────────────────────────────────
# Stage 2: build — compile frontend with Vite
# ──────────────────────────────────────────────
FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY . .

RUN bun run --filter @rocket/web build

# ──────────────────────────────────────────────
# Stage 3: release — runtime only
# Elysia serves API + static frontend assets
# ──────────────────────────────────────────────
FROM oven/bun:1-alpine AS release
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY --from=build /app/packages/web/dist ./packages/web/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "run", "packages/api/src/index.ts"]
