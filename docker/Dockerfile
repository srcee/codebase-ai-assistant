ARG NODE_IMAGE=node:22.15.0-bookworm-slim
ARG NGINX_IMAGE=nginx:1.27.5-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /workspace
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
ENV NX_DAEMON=false NX_NO_CLOUD=true NODE_ENV=production
COPY . .
RUN npx nx run-many -t build -p api web --skip-nx-cache

FROM deps AS migrate
COPY drizzle.config.ts ./
COPY libs/server/database/migrations ./libs/server/database/migrations
USER node
CMD ["npx", "drizzle-kit", "migrate"]

FROM ${NODE_IMAGE} AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/dist/apps/api/package.json /workspace/dist/apps/api/package-lock.json ./
# The pruned lock file Nx generates can miss transitive entries, so npm ci rejects it.
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /workspace/dist/apps/api ./
# Named volumes copy this ownership on first use; the token file must stay 0600 for uid 1000.
RUN mkdir -p /run/api-token /data && chown node:node /run/api-token /data && chmod 700 /run/api-token
USER node
CMD ["node", "main.js"]

FROM ${NGINX_IMAGE} AS web
COPY docker/web/nginx.conf.template /etc/caa/nginx.conf.template
COPY docker/web/entrypoint.sh /usr/local/bin/caa-web-entrypoint
COPY --from=build /workspace/dist/apps/web /usr/share/nginx/html
# Same uid as the api user, so nginx can read the 0600 token file.
RUN chmod 755 /usr/local/bin/caa-web-entrypoint \
  && mkdir -p /run/api-token && chown 1000:1000 /run/api-token && chmod 700 /run/api-token
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/caa-web-entrypoint"]
