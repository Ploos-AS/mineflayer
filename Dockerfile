# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

FROM node:24-alpine
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Ploos-AS Mineflayer" \
      org.opencontainers.image.description="Ready-to-run Mineflayer Minecraft bot container" \
      org.opencontainers.image.source="https://github.com/Ploos-AS/mineflayer" \
      org.opencontainers.image.url="https://github.com/Ploos-AS/mineflayer" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

ENV NODE_ENV=production \
    HEALTH_FILE=/tmp/mineflayer-healthy

WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD test -s "$HEALTH_FILE" || exit 1

CMD ["node", "src/bot.js"]
