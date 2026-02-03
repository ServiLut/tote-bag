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

# Instalamos dependencias SIN ignorar scripts para que Prisma descargue los binarios de Alpine
# (Esto es crucial para que funcione el Query Engine en Linux/Alpine)
RUN pnpm install --frozen-lockfile

# Copiamos el código fuente completo
COPY --from=base /app/out/full/ .

# Generar Prisma Client
# Usamos 'pnpm exec' para asegurar que encuentre el binario en el node_modules correcto
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

# Usamos 'pnpm exec' también aquí por consistencia, o ruta directa si pnpm no está en runner (node:alpine no trae pnpm por defecto)
# Como runner es base alpine, NO TIENE pnpm instalado globalmente.
# Opción A: Instalar pnpm en runner.
# Opción B: Usar npx (pero ya vimos que falla a veces).
# Opción C: Invocar el binario directo: ../../node_modules/.bin/prisma
# Vamos con la Opción C que es la más "nativa" y robusta sin instalar cosas extra.
CMD ["sh", "-c", "../../node_modules/.bin/prisma db push --config prisma.config.ts && node dist/main.js"]