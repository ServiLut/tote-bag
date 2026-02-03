# 1. Base y Prune
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune --scope=api --docker

# 2. Instalar y Construir
FROM node:22-alpine AS build
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiamos solo lo necesario para instalar dependencias (lockfile y package.jsons)
COPY --from=base /app/out/json/ .
COPY --from=base /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Instalamos todas las dependencias (incluyendo devDeps para el build y Prisma CLI)
RUN pnpm install --ignore-scripts --frozen-lockfile

# Copiamos el código fuente completo
COPY --from=base /app/out/full/ .

# Generar Prisma Client (Necesario antes del build)
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Construir la API
RUN pnpm run build --filter=api

# 3. Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Instalamos OpenSSL, necesario para Prisma Client en Alpine
RUN apk add --no-cache openssl

# Copiamos dependencias (incluye Prisma CLI para el db push)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api

EXPOSE 4000

# Volvemos a la raíz para ejecutar los comandos
WORKDIR /app

# NOTA: 'prisma db push' sincroniza el esquema al iniciar el contenedor.
# En producción seria, esto se hace en un paso previo (CI/CD), pero para Dokploy está bien.
CMD ["sh", "-c", "npx prisma db push --config apps/api/prisma.config.ts && node apps/api/dist/main.js"]