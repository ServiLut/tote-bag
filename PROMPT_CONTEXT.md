# Contexto Maestro: E-commerce de Tote Bags (Colombia)

## 1. Visión del Sistema
Mini-commerce de máxima conversión diseñado para el mercado colombiano, operando bajo un modelo híbrido: Stock (Disponible) y Hecho bajo pedido.

## 2. Reglas Técnicas Innegociables
* **Stack**: NestJS (Backend), Next.js (Frontend), Supabase (PostgreSQL), Bun (Runtime).
* **Base de Datos**: Mapeo en `snake_case` para PostgreSQL.
* **Nomenclatura SKU**: `TB-[COLECCIÓN]-[DISEÑO]-[COLOR]` (Ej: `TB-MASCOTAS-TERAPIA-CRUDO`).

## 3. Lógica de Negocio y Margen
* **Margen Bruto Objetivo**: ≥ 60%.
* **Defensa de Precio**: Cada producto tiene un `base_price` (Público) y un `min_price` (Precio Mínimo Autorizado - PMA).
* **Estados de Producto**: `DISPONIBLE`, `BAJO_PEDIDO`, `PREVENTA`.

## 4. Módulo B2B (Marcas)
* Separado del retail, enfocado en ventas por volumen.
* Paquetes: Starter, Pro, Evento.
* Campos obligatorios: Cantidad, Ciudad, Logo, Tipo de QR (WhatsApp/Web/IG).

## 5. UX y Conversión (Colombia-First)
* **Header**: Sticky en móvil con acceso rápido a WhatsApp y Carrito.
* **Post-venta**: El CTA principal tras la compra es el seguimiento vía WhatsApp con el número de orden.
