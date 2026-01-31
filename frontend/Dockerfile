# Stage 1: Build
FROM oven/bun:1 AS base
WORKDIR /app

# Copiamos los archivos de la raíz para manejar el lockfile del monorepo
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/

# Instalamos dependencias desde la raíz para el workspace frontend
RUN bun install --cwd ./frontend

# Copiamos el código fuente del frontend
COPY frontend ./frontend
WORKDIR /app/frontend

# INYECCIÓN DE VARIABLES (Esto evita el error del archivo .env inexistente)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Construir la aplicación
RUN bun run build

# Stage 2: Runner
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Importante: Next.js debe estar en modo standalone
COPY --from=base /app/frontend/public ./public
COPY --from=base /app/frontend/.next/standalone ./
COPY --from=base /app/frontend/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
