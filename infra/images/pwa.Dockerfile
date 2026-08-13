# syntax=docker/dockerfile:1
# Build context: ../../frontend (see infra/compose/compose.yaml).
FROM node:22-alpine AS build

ARG ALLOW_UNLOCKED_INSTALL=false

ENV CI=true \
    NX_DAEMON=false \
    NX_ADD_PLUGINS=false

WORKDIR /workspace

RUN corepack enable

# The lockfile is intentionally optional only for the very first local bootstrap.
# Production images must be built from a committed pnpm-lock.yaml.
COPY . ./
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile --dangerously-allow-all-builds; \
    elif [ "$ALLOW_UNLOCKED_INSTALL" = "true" ]; then \
      echo "WARNING: building without pnpm-lock.yaml; do not use this for production" >&2; \
      pnpm install --no-frozen-lockfile; \
    else \
      echo "pnpm-lock.yaml is required for a production frontend build." >&2; \
      echo "Generate and commit it, or set TT_ALLOW_UNLOCKED_FRONTEND_BUILD=true only for a disposable bootstrap." >&2; \
      exit 1; \
    fi

RUN pnpm nx build app --configuration=production

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

USER root

COPY --from=build /workspace/dist/apps/app/browser /usr/share/nginx/html

RUN rm -f /etc/nginx/conf.d/default.conf && \
    printf '%s\n' \
      'server {' \
      '    listen 8080;' \
      '    server_name _;' \
      '    root /usr/share/nginx/html;' \
      '    index index.html;' \
      '    server_tokens off;' \
      '    add_header X-Content-Type-Options "nosniff" always;' \
      '    location = /__pwa_health {' \
      '        default_type text/plain;' \
      '        add_header Cache-Control "no-store" always;' \
      '        return 200 "ok\\n";' \
      '    }' \
      '    location / {' \
      '        try_files $uri $uri/ /index.html;' \
      '    }' \
      '}' > /etc/nginx/conf.d/default.conf

USER 101

EXPOSE 8080
