# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

USER appuser

EXPOSE 3000

CMD ["node", "dist/api/index.js"]
