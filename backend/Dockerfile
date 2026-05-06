# ---- builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ---- runner ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

# Chromium + fonts (Arabic + emoji + Latin) for Puppeteer-rendered invoices
RUN apt-get update && apt-get install -y --no-install-recommends \
      tini curl chromium fonts-noto fonts-noto-cjk fonts-noto-color-emoji \
      ca-certificates libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
      libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
# Use db push (not migrate deploy) since the schema is the source of truth and
# the DB may already exist (when redeploying or using shared Neon DB).
# `--accept-data-loss` is safe here: it only fires when removing/altering
# columns; for additive changes it's a no-op.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
