# ════════════════════════════════════════════
# Multi-stage Dockerfile for the API server
# Build from monorepo root: docker build -f apps/api/Dockerfile .
# ════════════════════════════════════════════

# ─── Stage 1: Base ───
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache dumb-init libc6-compat
WORKDIR /app

# ─── Stage 2: Install and Build ───
FROM base AS build

# Copy package descriptors
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json

# Install dependencies for API ONLY (isolated from web)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter=api...

# Copy API source code
COPY apps/api ./apps/api

# Generate Prisma client for build
RUN pnpm --filter api exec prisma generate

# Build the API project
RUN pnpm --filter api build

# Deploy only the api app and its production dependencies to an isolated directory
RUN pnpm --filter api --prod deploy --legacy /app/out/api

# Generate Prisma client inside the deployed production folder
RUN cd /app/out/api && npx prisma@6.4.1 generate

# ─── Stage 3: Production ───
FROM base AS production
ENV NODE_ENV=production

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

# Copy the completely isolated, production-ready app
COPY --from=build --chown=appuser:nodejs /app/out/api /app

USER appuser

EXPOSE 3000

# Use dumb-init for proper signal handling (graceful shutdown)
CMD ["dumb-init", "node", "dist/server.js"]
