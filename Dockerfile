# ──────────────────────────────────────────────
# HiveMind WebUI — Production Container
# ──────────────────────────────────────────────
# Multi-stage build: compile TypeScript → slim runtime
# ──────────────────────────────────────────────

# ── Stage 1: Build ─────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files first (layer cache for deps)
COPY package.json package-lock.json ./

# Install all deps (including devDependencies for tsc)
RUN npm ci

# Copy source + assets
COPY tsconfig.json ./
COPY src/ src/
COPY skills/ skills/
COPY commands/ commands/
COPY agents/ agents/
COPY workflows/ workflows/

# Build TypeScript
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────
FROM node:20-alpine

LABEL maintainer="HiveMind Contributors"
LABEL description="HiveMind Context Governance WebUI"

WORKDIR /app

# Non-root user for security
RUN addgroup -S hivemind && adduser -S hivemind -G hivemind

# Copy package files and install production deps + required peer dependency
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --install-strategy=nested && \
    npm install --no-save @opencode-ai/plugin && \
    npm cache clean --force

# Copy built output and assets from builder
COPY --from=builder /build/dist/ dist/
COPY skills/ skills/
COPY commands/ commands/
COPY agents/ agents/
COPY workflows/ workflows/

# Create project directory for managed workspace
RUN mkdir -p /app/project && chown -R hivemind:hivemind /app

# Default environment
ENV HIVEMIND_PORT=3000 \
    HIVEMIND_HOST=0.0.0.0 \
    HIVEMIND_PROJECT_ROOT=/app/project \
    HIVEMIND_LOG_LEVEL=info \
    NODE_ENV=production

EXPOSE 3000

USER hivemind

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/help || exit 1

# Start WebUI server
CMD ["node", "dist/cli.js", "webui"]
