# syntax=docker/dockerfile:1
# Build context: ../../frontend (see infra/compose/compose.yaml).
FROM node:22-alpine AS build

ARG ALLOW_UNLOCKED_INSTALL=false

WORKDIR /workspace

RUN corepack enable

# See pwa.Dockerfile for the reason production refuses an unlocked dependency graph.
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

RUN pnpm nx build showcase --configuration=production

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Angular's server bundle keeps framework imports external. Copy the resolved
# dependency tree, but not source files or package-manager cache, into runtime.
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/dist/apps/showcase/browser ./browser
COPY --from=build /workspace/dist/apps/showcase/server ./server

USER node

EXPOSE 4000

CMD ["node", "server/server.mjs"]
