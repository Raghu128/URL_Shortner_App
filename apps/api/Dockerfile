# ════════════════════════════════════════════
# Multi-stage Dockerfile for the API server
# ════════════════════════════════════════════

# ─── Stage 1: Base ───
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ─── Stage 2: Dependencies ───
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# ─── Stage 3: Development (with hot reload) ───
FROM deps AS development
COPY . .
ENV NODE_ENV=development
CMD ["npx", "tsx", "watch", "src/server.ts"]

# ─── Stage 4: Build ───
FROM deps AS build
COPY . .
RUN npm run build

# ─── Stage 5: Production ───
FROM base AS production
ENV NODE_ENV=production

# Copy only production deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy built output and Prisma client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001
USER appuser

EXPOSE 3000

# Use dumb-init for proper signal handling (graceful shutdown)
CMD ["dumb-init", "node", "dist/server.js"]
