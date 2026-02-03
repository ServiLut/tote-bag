# 1. Base y Prune
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune --scope=web --docker

# 2. Instalar y Construir
FROM node:22-alpine AS build
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiamos lo necesario para instalar dependencias
COPY --from=base /app/out/json/ .
COPY --from=base /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Instalamos dependencias
RUN pnpm install --frozen-lockfile

# Copiamos el código fuente
COPY --from=base /app/out/full/ .

# Variables de entorno para el Build (Next.js las necesita en tiempo de build para inyectar valores estáticos)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Construimos la web
RUN pnpm run build --filter=web

# 3. Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Instalar libc6-compat para compatibilidad en Alpine
RUN apk add --no-cache libc6-compat

# Copiamos solo lo necesario para standalone
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/.next/standalone ./

EXPOSE 3000

CMD ["node", "apps/web/server.js"]