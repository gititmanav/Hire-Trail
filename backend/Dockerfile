# HireTrail API — production image (multi-stage).
# Build: compiles TS → dist with all deps. Run: prod-only deps + dist.
FROM node:20-bookworm-slim AS build
WORKDIR /app
# Build tools for native modules (bcrypt) — only in the build stage.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
EXPOSE 5050
CMD ["node", "dist/server.js"]
