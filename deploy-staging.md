# Deploy Staging Runbook

Fecha de referencia: 2026-04-29

Este documento describe el flujo real de validacion y despliegue de `apps/api`
y `apps/web` a `staging` sin tocar produccion.

## 1. Alcance del CI

El workflow `.github/workflows/ci.yml` valida solo la superficie afectada:

- `api` cuando cambian `apps/api/**` o archivos compartidos del monorepo.
- `web` cuando cambian `apps/web/**` o archivos compartidos del monorepo.
- `shared` incluye `packages/**`, `shared/**`, `package.json`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json` y los workflows.

Checks actuales:

- API: migraciones Prisma contra Postgres efimero, lint, unit tests, e2e,
  build y `docker build`.
- Web: lint de `@tote-bag/ui`, lint web, tests, build de `@tote-bag/ui`,
  build web y `docker build`.

El CI usa valores dummy para Supabase/Wompi y deja `REDIS_URL` vacio para usar
fallback en memoria. `staging` debe usar secretos reales.

## 2. Variables de entorno

Tomar como base:

- `apps/api/.env.example`
- `apps/web/.env.example`

Variables clave para `staging`:

- API: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SERVICE_ROLE`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Web: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_IMAGE_REMOTE_HOSTS`.

Notas:

- `DIRECT_URL` es la URL usada por `prisma migrate deploy`.
- `DATABASE_SSL=inherit` permite respetar el SSL ya definido en la URL de la
  base. Solo usar `DATABASE_SSL=false` si el destino requiere desactivarlo de
  forma explicita.
- `NEXT_PUBLIC_BASE_URL` es obligatoria en produccion y debe ser `https`.
- `NEXT_IMAGE_REMOTE_HOSTS` define la allowlist de hosts remotos para
  `next/image` y debe viajar con el build del web si `staging` sirve imagenes
  externas.
- `REDIS_URL` es opcional; si falta, la API cae a cache en memoria y
  `/api/v1/health` expone ese estado como degradado.

## 3. Preflight local o en runner

```bash
pnpm install --frozen-lockfile
```

API:

```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec eslint "{src,apps,libs,test}/**/*.ts"
pnpm --filter api exec jest --runInBand
pnpm --filter api exec jest --config ./test/jest-e2e.json --runInBand
pnpm --filter api build
docker build -f apps/api/Dockerfile -t tote-bag-api:staging-check .
```

Web:

```bash
pnpm --filter @tote-bag/ui lint
pnpm --filter web exec eslint .
pnpm --filter web exec jest --config ./jest.config.cjs --runInBand
pnpm --filter @tote-bag/ui build
NODE_ENV=production pnpm --filter web build
docker build \
  -f apps/web/Dockerfile \
  -t tote-bag-web:staging-check \
  --build-arg NEXT_PUBLIC_BASE_URL="$NEXT_PUBLIC_BASE_URL" \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_IMAGE_REMOTE_HOSTS="$NEXT_IMAGE_REMOTE_HOSTS" \
  .
```

PowerShell:

```powershell
$env:NODE_ENV = "production"
pnpm --filter web build

docker build `
  -f apps/web/Dockerfile `
  -t tote-bag-web:staging-check `
  --build-arg NEXT_PUBLIC_BASE_URL="$env:NEXT_PUBLIC_BASE_URL" `
  --build-arg NEXT_PUBLIC_API_URL="$env:NEXT_PUBLIC_API_URL" `
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$env:NEXT_PUBLIC_SUPABASE_URL" `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$env:NEXT_PUBLIC_SUPABASE_ANON_KEY" `
  --build-arg NEXT_IMAGE_REMOTE_HOSTS="$env:NEXT_IMAGE_REMOTE_HOSTS" `
  .
```

## 4. Orden de despliegue

1. Confirmar CI verde para la rama o PR.
2. Apuntar `DATABASE_URL` y `DIRECT_URL` a la base exclusiva de `staging`.
3. Ejecutar `pnpm --filter api exec prisma migrate deploy`.
4. Desplegar API.
5. Verificar API.
6. Desplegar web.
7. Verificar web y flujos criticos.

## 5. Smoke checks minimos

Sin autenticacion:

```bash
curl -f https://TU_API_STAGING/api/v1/health
curl -f https://TU_API_STAGING/api/v1/ready
curl -I https://TU_WEB_STAGING/
```

Script reutilizable:

```bash
SMOKE_API_URL=https://TU_API_STAGING/api/v1 \
SMOKE_WEB_URL=https://TU_WEB_STAGING \
pnpm smoke:staging
```

Opcional:

- `SMOKE_REQUIRE_HEALTH_OK=true` para fallar si `/health` responde
  `degraded`.

Con sesion de operador en `staging`:

- Abrir `/dashboard` y confirmar carga sin error 401/500.
- Revisar listado de productos o catalogo.
- Ejecutar un flujo critico del area afectada por el cambio.

## 6. Seeds y limites operativos

Seeds:

- Permitido solo en bases vacias: `pnpm --filter api seed`
- No automatizar en `staging`: `pnpm --filter api seed:all`
- No automatizar en `staging`: `pnpm --filter api seed:demo`

Limites conocidos:

- El contrato actual de `apps/web/Dockerfile` propaga estas variables publicas
  tanto al stage de build como al runner: `NEXT_PUBLIC_BASE_URL`,
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_IMAGE_REMOTE_HOSTS`.
- Cualquier variable publica adicional que el web necesite durante `docker build`
  o runtime requiere ampliar el Dockerfile en un cambio separado.
