# Production Readiness Plan

Fecha de referencia: 2026-04-22

Este documento convierte el analisis de front y back en una matriz operativa para cerrar brechas antes de produccion.

## Prioridad P0

| ID | Accion | Archivos / Areas | Impacto | Esfuerzo | Criterio de cierre |
| --- | --- | --- | --- | --- | --- |
| P0-1 | Implementar `GET /api/v1/health` y `GET /api/v1/ready`, y corregir smoke tests | `apps/api/src/main.ts`, `apps/api/src/app.controller.ts`, nuevo modulo/controlador de health, `deploy-staging.md` | Alto | Bajo | Existen endpoints estables para load balancer/orquestador y el checklist usa rutas reales |
| P0-2 | Endurecer imagenes Docker y hacerlas reproducibles | `apps/api/Dockerfile`, `apps/web/Dockerfile`, raiz `package.json` | Alto | Medio | Docker usa `pnpm@10.28.2`, corre con usuario no-root y tiene `HEALTHCHECK` |
| P0-3 | Reducir costo/riesgo de observabilidad | `apps/api/src/instrument.ts`, configuracion de entorno | Alto | Bajo | Sentry no envia PII por defecto y usa sampling conservador en produccion |
| P0-4 | Definir politica de Redis al caer | `apps/api/src/app.module.ts`, docs de despliegue | Alto | Bajo | Queda explicito si la API debe fallar rapido o degradar con alerta |
| P0-5 | Versionar pipeline de CI/CD minimo | `.github/workflows/*` o equivalente | Alto | Medio | Cada cambio valida `build`, `test`, `test:e2e` y `docker build` antes de deploy |

## Prioridad P1

| ID | Accion | Archivos / Areas | Impacto | Esfuerzo | Criterio de cierre |
| --- | --- | --- | --- | --- | --- |
| P1-1 | Eliminar roundtrips redundantes de rol en frontend autenticado | `apps/web/proxy.ts`, `apps/web/app/dashboard/layout.tsx`, `apps/web/lib/dashboard-auth.ts`, `apps/web/lib/frontend-routing.ts` | Medio/Alto | Medio | El rol se resuelve una vez por request o por sesion y no se duplica en middleware + layout |
| P1-2 | Proteger o aislar `/metrics` | `apps/api/src/app.module.ts`, infraestructura | Alto | Bajo/Medio | `/metrics` queda en red privada, auth de infraestructura o deshabilitado fuera de scraping interno |
| P1-3 | Formalizar matriz de variables de entorno | `apps/api/src/config/env.validation.ts`, `apps/web/lib/env.ts`, `.env.example`, docs | Medio | Medio | Existe contrato claro de `dev`, `staging`, `prod` por servicio |
| P1-4 | Corregir base URL publica del sitio | `apps/web/app/layout.tsx` | Medio | Bajo | `metadataBase` usa dominio real de produccion y no `localhost` |
| P1-5 | Definir rollback y operativa de migraciones | `apps/api/prisma.config.ts`, `deploy-staging.md`, runbooks | Alto | Medio | Hay orden de backup, `migrate deploy`, validacion y rollback documentado |

## Prioridad P2

| ID | Accion | Archivos / Areas | Impacto | Esfuerzo | Criterio de cierre |
| --- | --- | --- | --- | --- | --- |
| P2-1 | Agregar smoke tests funcionales post-deploy | scripts de smoke o workflow de deploy | Medio | Medio | Se validan login, catalogo, checkout y dashboard critico |
| P2-2 | Medir latencia de endpoints criticos | API financiera, perfil, dashboard | Medio | Medio | Hay umbrales basicos de tiempo y alertas |
| P2-3 | Revisar redaccion de logs sensibles | `apps/api/src/main.ts`, logger Winston | Medio | Bajo | Logs no exponen tokens, correos completos ni datos sensibles innecesarios |
| P2-4 | Mover gestion de buckets a infraestructura declarativa | `apps/api/src/common/storage/storage.service.ts`, IaC | Medio | Medio/Alto | Buckets y politicas existen antes del arranque de la app |
| P2-5 | Cerrar deuda documental y flujos hibridos | `apps/web/app/dashboard/finanzas/nomina/TECH_SPEC.md`, modulo nomina | Bajo/Medio | Bajo | La documentacion refleja el estado real del modulo y no induce a operar con supuestos viejos |

## Top 5 para atacar primero en codigo

1. P0-1 Health/readiness y smoke real
   - Es el bloqueo mas inmediato para despliegue confiable.
   - Hoy el checklist apunta a rutas que no existen.

2. P0-2 Docker reproducible y endurecido
   - Reduce riesgo de "en mi maquina si sirve".
   - Cierra una brecha basica de seguridad operacional.

3. P0-3 Observabilidad con costo controlado
   - Evita ruido, gasto y exposicion de datos desde el dia uno.

4. P1-1 Resolucion de rol en frontend
   - Baja latencia y acoplamiento entre front y back.
   - Tiene impacto directo en UX y estabilidad.

5. P1-4 `metadataBase` y configuracion publica del sitio
   - Es pequeno, rapido y afecta SEO/canonicals en produccion.

## Orden de ejecucion recomendado

1. P0-1
2. P0-2
3. P0-3
4. P0-4
5. P0-5
6. P1-1
7. P1-2
8. P1-3
9. P1-4
10. P1-5

## Entregables por bloque

### Bloque 1

- Health controller listo
- `deploy-staging.md` corregido
- Smoke post-deploy ejecutable

### Bloque 2

- Dockerfiles alineados con la version real de `pnpm`
- Usuario no-root
- `HEALTHCHECK`

### Bloque 3

- Sampling de Sentry por entorno
- Politica de PII documentada

### Bloque 4

- Politica Redis definida
- Pipeline versionado

## Definicion de "listo para produccion"

Consideraria el sistema listo para una primera salida a produccion cuando:

- Todos los P0 esten cerrados.
- P1-1, P1-2 y P1-4 esten cerrados.
- `api build`, `api test`, `api test:e2e`, `web test`, `web build` y `docker build` de ambos servicios pasen en CI.
- Exista smoke test post-deploy sobre entorno real.
