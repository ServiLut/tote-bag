# 1. Base y Prune
FROM node:22-alpine AS base
WORKDIR /app
ARG TURBO_VERSION=2.8.1
RUN npm install turbo@${TURBO_VERSION} --global
COPY . .
RUN turbo prune --scope=api --docker

# 2. Instalar y Construir
FROM node:22-alpine AS build
WORKDIR /app
ARG PNPM_VERSION=10.28.2

RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=base /app/out/json/ .
COPY --from=base /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY --from=base /app/out/full/ .

RUN pnpm --filter=api exec prisma generate
RUN pnpm --filter=api build

# 2b. Dependencias de runtime
FROM node:22-alpine AS prod-deps
WORKDIR /app
ARG PNPM_VERSION=10.28.2

RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=base /app/out/json/ .
COPY --from=base /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# 3. Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:4000/api/v1/health || exit 1
USER node

CMD ["node", "dist/main.js"]
