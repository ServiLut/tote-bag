# --- Etapa de Construcción ---
FROM oven/bun:1-bookworm AS base

# Instalamos dependencias del sistema necesarias para Prisma y herramientas de compilación
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Copiamos archivos de la raíz para aprovechar el caché de capas de Bun
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/

# 2. Instalamos dependencias del monorepo enfocadas en el frontend
RUN bun install --filter frontend

# 3. Copiamos el código del frontend
COPY frontend ./frontend

# 4. Cambiamos al directorio del frontend para el build
WORKDIR /app/frontend

# Definir argumentos de construcción (Build Args) para Next.js
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# 5. Construimos la aplicación
# Nota: Asegúrate de tener 'output: "standalone"' en tu next.config.ts
RUN bun run build

# --- Etapa de Producción (Runner) ---
# Usamos Node para el runner ya que el modo standalone de Next.js está optimizado para él
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Instalamos openssl para la conectividad de base de datos si fuera necesario
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiamos solo los artefactos necesarios del modo standalone
COPY --from=base /app/frontend/public ./public
COPY --from=base /app/frontend/.next/standalone ./
COPY --from=base /app/frontend/.next/static ./.next/static

EXPOSE 3000

# El modo standalone genera un archivo server.js que no requiere node_modules externos
CMD ["node", "server.js"]
