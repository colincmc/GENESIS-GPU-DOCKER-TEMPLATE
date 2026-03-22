# ── GENESIS GPU SERVICE TEMPLATE — CPU Fallback ─────────────────────
# Standard Node.js image — what Spine Heartbeat falls back to
# Identical API surface, zero GPU deps, runs on any EC2 instance
# Usage:  docker build -t genesis-gpu-service .
# ────────────────────────────────────────────────────────────────────

FROM node:20.20.0-slim
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install && npm cache clean --force
COPY src ./src
RUN npx tsc
RUN npm prune --production
EXPOSE 8787
CMD ["node", "dist/index.js"]
