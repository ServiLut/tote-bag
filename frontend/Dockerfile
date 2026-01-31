FROM oven/bun:1 AS base
WORKDIR /app

# Copiamos desde la raíz del monorepo
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
RUN bun install --cwd ./frontend

COPY frontend ./frontend
WORKDIR /app/frontend

# Inyección de variables en tiempo de compilación
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN bun run build

# ... resto del stage de runner
