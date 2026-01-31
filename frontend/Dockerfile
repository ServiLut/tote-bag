# --- Etapa de Construcción ---
FROM oven/bun:1 AS base

# Instalamos dependencias necesarias
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiamos archivos de la raíz (Contexto /)
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/

# Instalamos dependencias del workspace frontend
RUN bun install --filter frontend

# Copiamos el código del frontend
COPY frontend ./frontend

# Entramos a la carpeta para construir
WORKDIR /app/frontend

# Variables que Dokploy inyectará (configúralas en la pestaña Environment de Dokploy)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN bun run build

# --- Etapa de Producción ---
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiamos los archivos generados por Next.js standalone
COPY --from=base /app/frontend/public ./public
COPY --from=base /app/frontend/.next/standalone ./
COPY --from=base /app/frontend/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
