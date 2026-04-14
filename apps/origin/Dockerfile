FROM node:22-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY apps/origin/package.json apps/origin/tsconfig.json ./apps/origin/
COPY apps/origin/src ./apps/origin/src
COPY apps/origin/db ./apps/origin/db

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @relaynews/shared build
RUN pnpm --filter @relaynews/origin build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/origin/package.json ./apps/origin/package.json
COPY --from=build /app/apps/origin/dist ./apps/origin/dist
COPY --from=build /app/apps/origin/db ./apps/origin/db

EXPOSE 8787

CMD ["node", "apps/origin/dist/server.js"]
