# ==========================================
# Stage 1: Builder
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Runner (Production)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies + tsx & drizzle-kit (needed for runtime execution)
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx drizzle-kit

# Copy build output and necessary source files for Next.js & custom Socket.io server
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000

# Push DB schema, run auto-seeder (idempotent), and start the custom Next.js + Socket server
CMD npx drizzle-kit push && npx tsx src/db/init.ts && npx tsx server.ts
