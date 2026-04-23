# Deploy Staging Checklist

Fecha de referencia: 2026-04-21

Este documento deja el flujo recomendado para validar y desplegar `api` y `web` en un entorno de `staging` antes de promoción a producción.

## Prerrequisitos

- Configurar variables de entorno de `staging` separadas de producción.
- Confirmar que `DATABASE_URL` apunta a la base de `staging`.
- Confirmar que Docker está disponible si se van a validar imágenes.
- Tener disponibles:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 1. Instalar dependencias

```bash
pnpm install --frozen-lockfile
```

## 2. API: generar cliente Prisma y aplicar migraciones

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
```

## 3. API: validación previa al deploy

```bash
pnpm --filter api build
pnpm --filter api exec jest --runInBand
pnpm --filter api test:e2e
```

## 4. API: preflight de contenedor

```bash
docker build -f apps/api/Dockerfile -t tote-bag-api:staging-check .
```

## 5. Web: validación previa al deploy

```bash
pnpm --filter web exec tsc -p tsconfig.json --noEmit
pnpm --filter web exec jest --config ./jest.config.cjs --runInBand
pnpm --filter web build
```

## 6. Web: preflight de contenedor

En Windows PowerShell:

```powershell
docker build `
  -f apps/web/Dockerfile `
  -t tote-bag-web:staging-check `
  --build-arg NEXT_PUBLIC_API_URL="$env:NEXT_PUBLIC_API_URL" `
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$env:NEXT_PUBLIC_SUPABASE_URL" `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$env:NEXT_PUBLIC_SUPABASE_ANON_KEY" `
  .
```

En Bash:

```bash
docker build \
  -f apps/web/Dockerfile \
  -t tote-bag-web:staging-check \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  .
```

## 7. Smoke mínimo post-deploy en staging

Reemplazar URLs por las de `staging`.

```bash
curl -f https://TU_API_STAGING/api/v1/health
curl -f https://TU_API_STAGING/api/v1/ready
curl -f https://TU_API_STAGING/api/v1/finance/tax-report
curl -f https://TU_API_STAGING/api/v1/finance/order-profitability
curl -f https://TU_API_STAGING/api/v1/finance/break-even-thermometer
curl -f https://TU_WEB_STAGING
```

## 8. Regla operativa de seeds

Seed base permitido solo para entornos vacíos:

```bash
pnpm --filter api seed
```

No correr en producción:

```bash
pnpm --filter api seed:all
pnpm --filter api seed:demo
```

## 9. Orden recomendado

1. Ejecutar migraciones en `staging`.
2. Validar API.
3. Validar contenedor API.
4. Desplegar API.
5. Ejecutar smoke financiero y logístico.
6. Validar Web.
7. Validar contenedor Web.
8. Desplegar Web.
9. Ejecutar smoke final.

## 10. Notas conocidas

- En el entorno local Windows de referencia, `pnpm --filter web build` puede fallar por un problema de rutas de `.tsbuildinfo` de Next.js/Turbopack aun cuando el código compile y el `tsc --noEmit` pase.
- La etapa de migraciones no debe ejecutarse hasta contar con un entorno `staging` claramente separado de producción.
- Los conflictos de referencias base detectados en FASE 11 deben resolverse aparte y no formar parte de un despliegue automático.
