# Mejoras Pendientes para el Dashboard y Arquitectura (Basado en @paso.md)

Este documento detalla los elementos faltantes para que el proyecto `tote-bag` cumpla con los estándares de producción definidos en la arquitectura empresarial.

## 1. Seguridad y Cumplimiento (Prioridad Alta)

Estos elementos son críticos para proteger la aplicación y cumplir con la normativa.

- [ ] **Sistema RBAC (Control de Acceso Basado en Roles):**
    - Falta implementar las tablas `roles`, `permissions`, `user_roles` y `role_permissions` en el esquema de base de datos.
    - Falta crear el `PermissionsGuard` y el decorador `@RequirePermissions` en NestJS para proteger endpoints específicos.
- [ ] **Auditoría (Audit Logging):**
    - Falta la tabla `audit_logs` para registrar *quién* hizo *qué*.
    - Falta el `AuditInterceptor` en el backend para interceptar métodos de escritura (POST, PUT, DELETE) y guardar el registro automáticamente.
- [ ] **Rate Limiting (Límite de Peticiones):**
    - No está configurado `ThrottlerModule` ni `CustomThrottlerGuard` para prevenir ataques de fuerza bruta o DoS.
- [ ] **Habeas Data (Legal Colombia):**
    - Falta el checkbox de aceptación explícita de política de datos en los formularios de registro/checkout y su registro en base de datos (fecha/IP).

## 2. Arquitectura Backend

Mejoras necesarias para la mantenibilidad y escalabilidad del código.

- [ ] **Versionado de API:**
    - Falta habilitar el versionado global por URI (`/api/v1/...`) en `main.ts` para evitar romper clientes futuros.
- [ ] **Configuración Centralizada:**
    - Falta crear la carpeta `src/config` y el archivo `env.validation.ts`. Actualmente se depende de `process.env` sin validación de tipos, lo cual es riesgoso en producción.
- [ ] **Observabilidad:**
    - **Logging:** Falta integrar **Winston** para logs estructurados (JSON).
    - **Métricas:** Falta configurar **Prometheus** para métricas de rendimiento.
    - **Tracking de Errores:** Falta la integración con **Sentry** para capturar excepciones en tiempo real.

## 3. Esquema de Base de Datos (Prisma)

El archivo `schema.prisma` necesita actualización para soportar toda la lógica de negocio.

- [ ] **Tablas Faltantes:**
    - `webhook_events`: Para garantizar la idempotencia en los pagos (evitar cobros dobles).
    - `addresses`: Para manejar múltiples direcciones por usuario, separado de la orden.
    - `audit_logs`: Para el registro de seguridad.
- [ ] **Modelo de Usuarios:**
    - Se requiere una tabla `users` más robusta que sincronice con Supabase Auth y maneje roles, en lugar de depender solo de `Profile`.

## 4. Funcionalidad UI/UX del Dashboard (Frontend)

Mejoras en la experiencia de usuario para los administradores.

- [ ] **Gestión de Productos (`AdminProductForm`):**
    - **SEO Preview:** Falta un componente visual que muestre cómo se verá el producto en los resultados de Google (título y descripción).
    - **Cálculos Visuales:** Mostrar explícitamente el porcentaje de descuento y margen de ganancia en tiempo real al editar precios.
- [ ] **Gestión de Pedidos (`OrdersManager`):**
    - **Acciones Rápidas:** Implementar un *dropdown* de cambio de estado directamente en la tabla de lista, para no tener que abrir el modal para cambios simples.
    - **Filtros Avanzados:** Faltan filtros por Rango de Fechas, Búsqueda por Cliente/Email y Filtrado múltiple por Estado.

---
**Siguiente Paso Recomendado:** Actualizar `backend/prisma/schema.prisma` con las tablas de seguridad y auditoría.
