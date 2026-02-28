# ════════════════════════════════════════════
# Multi-stage Dockerfile for Next.js Frontend
# Build from monorepo root: docker build -f apps/web/Dockerfile .
# ════════════════════════════════════════════

# ─── Stage 1: Base ───
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Stage 2: Dependencies ───
FROM base AS deps

# Copy root workspace config + lockfile
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json

# Install only the web workspace dependencies
RUN npm ci --workspace=apps/web --include-workspace-root

# ─── Stage 3: Build ───
FROM base AS build

# Copy the entire workspace structure so Next.js can resolve packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy web source code
COPY apps/web ./apps/web

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js
RUN cd apps/web && npm run build

# ─── Stage 4: Production ───
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (preserves monorepo structure: apps/web/server.js)
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets into the correct path
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy public assets
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# server.js is at apps/web/server.js in standalone monorepo output
CMD ["node", "apps/web/server.js"]
