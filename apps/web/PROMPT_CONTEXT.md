# Contexto Maestro: Proyecto Tote Bag (E-commerce & ERP)

## 1. Visión del Sistema
Plataforma integral de comercio electrónico y gestión empresarial (ERP) especializada en la venta y personalización de tote bags para el mercado colombiano. El sistema opera bajo un modelo híbrido: Stock (Disponible) y Personalización (Hecho bajo pedido).

## 2. Reglas Técnicas Actualizadas (Mayo 2026)
*   **Stack Principal:** Next.js 16+ (App Router), React 19, TypeScript.
*   **Estilos:** Tailwind CSS 4.0 (Utilizando `@tailwindcss/postcss`).
*   **Backend & Data:** Supabase (PostgreSQL) con integración SSR (`@supabase/ssr`).
*   **Infraestructura:** Dockerized, Monorepo ready.
*   **API Strategy:** Sistema de **API Proxy** interno con reintentos automáticos y failover entre múltiples candidatos de URL (local/producción).
*   **Consistencia Temporal:** Todas las operaciones de negocio y reportes utilizan la zona horaria `America/Bogota` (vía `lib/bogota-date.ts`).

## 3. Arquitectura del Proyecto
*   **Storefront (`app/(store)`):** Enfoque en conversión, personalización de diseños y checkout integrado con Wompi.
*   **ERP/Dashboard (`app/dashboard`):** Gestión robusta de Pedidos, Inventario, Logística y Finanzas (KPIs, Flujo de Caja).
*   **Lógica Core (`lib/`):**
    *   `finance-dashboard.ts`: Procesamiento de datos financieros y rentabilidad.
    *   `api-proxy.ts`: Gestión de comunicaciones seguras y resilientes.
    *   `i18n.ts`: Internacionalización dinámica.

## 4. Lógica de Negocio y Margen
*   **Margen Bruto Objetivo:** ≥ 60%.
*   **Nomenclatura SKU:** `TB-[COLECCIÓN]-[DISEÑO]-[COLOR]`.
*   **Estados de Producto:** `DISPONIBLE`, `BAJO_PEDIDO`, `PREVENTA`.

## 5. Módulo B2B y Corporativo
*   Flujos especializados para ventas por volumen y beneficios empresariales.
*   Gestión de personalización masiva (logos, QRs, artes).

## 6. UX y Conversiación (Colombia-First)
*   Integración nativa con WhatsApp para soporte y seguimiento.
*   Pasarela de pagos: **Wompi** (Soporte para tarjetas, PSE, corresponsales).
*   Logística: Gestión de puntos de recogida y envíos nacionales.

---
*Este documento es la fuente de verdad para el desarrollo y análisis del sistema.*
