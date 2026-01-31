FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependencias del monorepo y del frontend
COPY package.json bun.lock ../
COPY frontend/package.json ./frontend/
RUN bun install --cwd ./frontend

# Copiar código fuente y construir
COPY frontend ./frontend
WORKDIR /app/frontend

# Variables de entorno para el build (Dokploy las inyectará)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN bun run build

# Etapa de ejecución
FROM node:20-slim AS runner
WORKDIR /app

# Next.js standalone necesita copiar la carpeta .next/standalone
COPY --from=base /app/frontend/public ./public
COPY --from=base /app/frontend/.next/standalone ./
COPY --from=base /app/frontend/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
