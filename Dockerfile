# ── Stage 1: backend builder ──────────────────────────────────────────────────
FROM node:20-slim AS backend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: frontend builder ─────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ .

RUN npm run build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/public/dashboard ./public/dashboard
COPY drizzle ./drizzle

USER appuser

EXPOSE 3000

CMD ["node", "dist/api/index.js"]
