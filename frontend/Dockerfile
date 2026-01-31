FROM oven/bun:1 AS base
WORKDIR /app

# Copiamos archivos de la raíz (asumiendo que el contexto de build es la raíz del monorepo)
COPY package.json bun.lock ./
# Copiamos el package del frontend a su subcarpeta
COPY frontend/package.json ./frontend/

# Instalamos usando el lockfile de la raíz pero solo para el workspace frontend
RUN bun install --filter frontend

# Copiamos el resto del código
COPY frontend ./frontend

# Cambiamos al directorio de trabajo del frontend para el build
WORKDIR /app/frontend

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN bun run build

FROM node:20-slim AS runner
WORKDIR /app

# Copiamos los artefactos del build standalone
COPY --from=base /app/frontend/public ./public
COPY --from=base /app/frontend/.next/standalone ./
COPY --from=base /app/frontend/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
