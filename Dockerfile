# Stage 1: Build packages
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Copy workspace manifests and base configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build shared types, web viewer SPA, and server backend
RUN pnpm --filter @brachio/shared build && \
    pnpm --filter @brachio/web build && \
    pnpm --filter @brachio/server build

# Stage 2: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm@9

ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/web-dist

# Copy package manifests for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install production dependencies
RUN pnpm --filter @brachio/server install --prod

# Copy built code
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist /app/web-dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "apps/server/dist/server.js"]
