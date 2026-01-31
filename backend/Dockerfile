# Usa la imagen oficial de Bun
FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependencias
COPY package.json bun.lock ../
COPY backend/package.json ./backend/
RUN bun install --cwd ./backend

# Copiar código fuente y esquema de Prisma
COPY backend ./backend
WORKDIR /app/backend

# Generar cliente de Prisma y construir la app
RUN bun x prisma generate
RUN bun run build

# Etapa final de producción
FROM oven/bun:1-slim
WORKDIR /app

# Copiar solo lo necesario desde la etapa de build
COPY --from=base /app/backend/dist ./dist
COPY --from=base /app/backend/node_modules ./node_modules
COPY --from=base /app/backend/package.json ./package.json
COPY --from=base /app/backend/prisma ./prisma

# Exponer el puerto (NestJS suele usar el 3000)
EXPOSE 4000

# Comando para ejecutar migraciones y arrancar la app
CMD ["sh", "-c", "bun x prisma migrate deploy && bun run start:prod"]
