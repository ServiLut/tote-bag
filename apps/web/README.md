# Tote Bag - Modern E-commerce & ERP Platform

Este proyecto es una plataforma integral de comercio electrónico y gestión empresarial (ERP) especializada en la venta y personalización de tote bags. Está diseñado con un enfoque moderno, escalable y modular.

---

## 🏗️ Arquitectura y Stack Tecnológico

- **Framework:** [Next.js 15+](https://nextjs.org/) (App Router, React 19)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Base de Datos y Autenticación:** [Supabase](https://supabase.com/) (PostgreSQL + Auth SSR)
- **Estilos:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Gestión de Estado:** React Context API (CartContext)
- **Internacionalización:** [i18next](https://www.i18next.com/) con soporte multi-idioma dinámico.
- **Visualización de Datos:** [Recharts](https://recharts.org/) (Dashboards financieros).
- **Pasarela de Pagos:** Integración con [Wompi](https://wompi.co/) (Colombia).
- **Testing:** [Jest](https://jestjs.io/)
- **Infraestructura:** Dockerized, Monorepo ready (Turborepo).

---

## 📂 Estructura del Proyecto

```text
apps/web/
├── app/                    # Rutas de Next.js (App Router)
│   ├── (auth)/             # Login, Registro, Recuperación de contraseña
│   ├── (store)/            # Tienda B2C/B2B (Catálogo, Checkout, Beneficios)
│   ├── api/                # Endpoints locales y Proxy de API
│   └── dashboard/          # ERP (Finanzas, Logística, Pedidos, Inventario)
├── components/             # UI Components (Store, Dashboard, Base UI)
├── context/                # Contextos globales (CartContext)
├── lib/                    # Lógica de negocio core
│   ├── api-proxy.ts        # Sistema de reintentos y failover de API
│   ├── finance-dashboard.ts# Motor de analítica financiera
│   ├── bogota-date.ts      # Normalización de zona horaria (America/Bogota)
│   └── personalization.ts  # Gestión de diseños y uploads
├── public/                 # Assets y traducciones (locales)
├── types/                  # Definiciones de tipos TypeScript
└── utils/                  # Utilidades y configuración de Supabase
```

---

## 🛠️ Implementaciones Clave

1. **API Proxy System:** Abstracción de la comunicación con el backend mediante un proxy interno que maneja reintentos automáticos y múltiples candidatos de URL para alta disponibilidad.
2. **Business Timezone Consistency:** Uso de `America/Bogota` en toda la lógica de fechas para garantizar reportes financieros precisos.
3. **Módulo ERP Robusto:** Dashboard administrativo con seguimiento de KPIs en tiempo real, flujo de caja y gestión logística avanzada.
4. **Checkout Personalizado:** Integración con Wompi y sistema de carga de diseños para productos únicos.

---

## 🚀 Módulos Principales

### 1. Storefront (B2C & B2B)
- Catálogo dinámico con filtrado avanzado.
- Sistema de personalización de tote bags.
- Flujo de checkout optimizado con múltiples puntos de entrega.

### 2. Panel Administrativo (ERP)
- **Finanzas:** Visualización de rentabilidad, eventos financieros y cuentas por cobrar.
- **Operaciones:** Gestión de pedidos y estados logísticos.
- **CRM:** Historial detallado de clientes y transacciones.

---

## 🔮 Futuras Mejoras y Análisis (Contexto para IA)

Si estás analizando este proyecto con una IA, considera estas áreas:
1. **Optimización de Server Components:** Migración de lógica del Dashboard a RSC para mejorar performance.
2. **Seguridad del Proxy:** Auditoría de la sanitización de headers en el sistema de proxy.
3. **IA Generativa:** Integración de herramientas para ayudar al usuario en la creación de diseños personalizados.
4. **Edge Computing:** Migración de lógica pesada de `lib/` a Supabase Edge Functions.

---

## 🛠️ Comandos

```bash
npm install     # Instalar dependencias
npm run dev     # Servidor de desarrollo
npm run build   # Construcción para producción
npm run test    # Ejecutar tests (Jest)
```

---
Este archivo proporciona el contexto completo del estado actual del proyecto (Mayo 2026).

