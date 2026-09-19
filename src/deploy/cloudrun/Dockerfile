# Build from src/: docker build -f deploy/cloudrun/Dockerfile ... .
ARG VALHALLA_IMAGE=ghcr.io/valhalla/valhalla-scripted@sha256:69e75b73c133d772ed76b8c241302c76881e7066ab697fc96e2ef8f26f29b996
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY app ./app
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts
COPY next.config.mjs postcss.config.mjs tailwind.config.js ./
ARG NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL
RUN test -n "$NEXT_PUBLIC_MAP_STYLE_URL" && npm run build && npm prune --omit=dev

FROM ${VALHALLA_IMAGE} AS runtime
WORKDIR /app
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
COPY --from=web-build /app/node_modules ./node_modules
COPY --from=web-build /app/.next ./.next
COPY --from=web-build /app/public ./public
COPY --from=web-build /app/package.json /app/next.config.mjs ./
COPY lib ./lib
COPY scripts ./scripts
COPY deploy/cloudrun ./deploy/cloudrun
# The Dockerfile-specific allowlist includes the graph, PBF, SQLite support
# databases, spatial ZIPs and optional historical baseline, never private state.
COPY data ./data
RUN node deploy/cloudrun/configure-valhalla.mjs && node --version
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 \
    VALHALLA_URL=http://127.0.0.1:8002 RUN_COMMUTE_MONITOR=false
EXPOSE 8080
ENTRYPOINT ["node", "deploy/cloudrun/start.mjs"]
