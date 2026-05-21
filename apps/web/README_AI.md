# Tote Bag Project - AI Analysis Context

Este documento proporciona una visión técnica profunda del proyecto **Tote Bag** para facilitar su análisis por sistemas de IA. Contiene detalles sobre la arquitectura, lógica de negocio core y el estado actual de la implementación.

---

## 🏗️ Arquitectura y Stack Tecnológico

### Core Stack
- **Framework:** Next.js 16+ (App Router) con React 19.
- **Lenguaje:** TypeScript (Estricto).
- **Estilos:** Tailwind CSS 4.0 (Utilizando `@tailwindcss/postcss`).
- **Base de Datos / Auth:** Supabase (PostgreSQL) con integración SSR (`@supabase/ssr`).
- **Estado Global:** React Context (CartContext) para la tienda; Server Components para el dashboard.
- **Internacionalización:** i18next + react-i18next (Soporte multi-idioma dinámico).

### Infraestructura
- **Entorno:** Dockerized (Dockerfile incluido).
- **Monorepo Ready:** Estructura compatible con Turborepo (referencia a `@tote-bag/ui`).
- **Deployment:** Preparado para despliegue en contenedores o Vercel.

---

## 📂 Mapa del Proyecto (Deep Dive)

### `/app` (Rutas y UI)
- **`(auth)`:** Implementa flujos de login, registro, recuperación de contraseña y reset. Usa Supabase Auth.
- **`(store)`:** La tienda pública. Incluye catálogo, checkout, secciones B2B/Corporativo y una sección de "Beneficios".
- **`dashboard`:** El ERP administrativo. Módulos de Finanzas, Logística, Pedidos, Inventario y CRM.
- **`api`:** Endpoints locales, destacando `/api/proxy` para comunicación segura con el backend.

### `/lib` (Lógica de Negocio Core)
- **`api-proxy.ts` & `api-config.ts`:** Sistema sofisticado de conexión. Maneja reintentos automáticos (retry logic), candidatos de URL (failover) y saneamiento de headers.
- **`finance-dashboard.ts`:** Motor de reportes financieros. Calcula KPIs, flujos de caja, cuentas por cobrar y rentabilidad.
- **`bogota-date.ts`:** Normalización de zona horaria (`America/Bogota`) para garantizar que todas las transacciones de negocio sean consistentes independientemente de la ubicación del servidor.
- **`personalization-design-upload.ts`:** Lógica para la gestión de archivos y personalización de productos por parte del usuario.
- **`wompi.ts`:** Integración profunda con la pasarela de pagos Wompi (Colombia).

### `/components`
- **`ui/`:** Componentes base atómicos.
- **`store/`** & **`dashboard/`:** Componentes especializados por dominio para evitar contaminación de lógica.

---

## 🛠️ Implementaciones Técnicas Notables

1. **Estrategia de API Proxy:**
   El frontend no se comunica directamente con la API externa. Utiliza un proxy interno que gestiona:
   - Failover entre múltiples "candidates" (localhost, IPs privadas, URLs públicas).
   - Reintentos en errores transitorios (502, 503, 504).
   - Abstracción total del origen de datos para el cliente.

2. **Consistencia Temporal:**
   Debido a la naturaleza del negocio (ERP/Ventas), se utiliza un sistema de fechas custom (`BogotaDate`) para evitar errores de desfase por UTC en reportes financieros y cierres de caja.

3. **Internacionalización (i18n):**
   Implementada para soportar expansión regional, con detección de lenguaje en el navegador y carga de recursos vía `public/locales`.

4. **Visualización de Datos:**
   Uso intensivo de `Recharts` en el dashboard para análisis de tendencias de ingresos y gastos.

---

## 🎯 Finalidad y Casos de Uso Actuales
1. **B2C Storefront:** Venta directa de tote bags personalizadas.
2. **B2B Engine:** Gestión de pedidos corporativos a gran escala.
3. **ERP Interno:** Control total de la operación (desde la orden hasta el reporte financiero).

---

## 🔮 Áreas de Análisis para la IA
*Al analizar este proyecto, se recomienda poner foco en:*

1. **Optimización de Server Components:** ¿Qué partes del dashboard podrían beneficiarse de una mayor migración a RSC para reducir el JS en el cliente?
2. **Seguridad en el Proxy:** Analizar la sanitización de headers en `api-proxy.ts`.
3. **Escalabilidad del ERP:** Evaluar si la lógica financiera en `lib/` debería migrarse a microservicios o Supabase Edge Functions.
4. **Mejora de UX en Checkout:** Sugerencias para optimizar el flujo de `CartContext` y la integración con `Wompi`.
5. **SEO y Performance:** Evaluar el impacto de la estructura del App Router en el posicionamiento del catálogo.

---
*Este archivo resume el estado técnico del proyecto a fecha de Mayo 2026.*
