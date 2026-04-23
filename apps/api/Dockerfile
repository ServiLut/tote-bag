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

# Instalar dependencias necesarias para Prisma en Alpine
RUN apk add --no-cache openssl libc6-compat

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copiamos solo lo necesario para instalar dependencias
COPY --from=base /app/out/json/ .
COPY --from=base /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Instalamos dependencias de producción y desarrollo para el build
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copiamos el código fuente completo
COPY --from=base /app/out/full/ .

# Generar Prisma Client
RUN pnpm --filter=api exec prisma generate

# Construir la API
RUN pnpm --filter=api build

# Limpiar dependencias de desarrollo para dejar solo las de producción

# 3. Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Instalamos OpenSSL para Prisma
RUN apk add --no-cache openssl

# Copiamos solo lo necesario para la ejecución
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:4000/api/v1/health || exit 1
USER node

CMD ["node", "dist/main.js"]
