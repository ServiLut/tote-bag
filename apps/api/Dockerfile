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

# Copiamos solo lo necesario para instalar dependencias
COPY --from=base /app/out/json/ .
COPY --from=base /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# INSTALAMOS CON --ignore-scripts para evitar que 'postinstall' falle
# al no encontrar el schema.prisma (que aún no se ha copiado).
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copiamos el código fuente completo (ahora sí tenemos el schema)
COPY --from=base /app/out/full/ .

# Generar Prisma Client
# Al ejecutar esto AHORA (con el schema presente), Prisma también
# descargará los binarios necesarios (Query Engine) para Alpine.
RUN pnpm exec prisma generate --schema=apps/api/prisma/schema.prisma

# Construir la API
RUN pnpm run build --filter=api

# 3. Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Instalamos OpenSSL (necesario para Prisma en Alpine)
RUN apk add --no-cache openssl

# Copiamos dependencias y build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

WORKDIR /app/apps/api

EXPOSE 4000

# Usamos el binario local de prisma
CMD ["sh", "-c", "../../node_modules/.bin/prisma db push --config prisma.config.ts && node dist/main.js"]