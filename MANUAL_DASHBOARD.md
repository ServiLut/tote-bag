# Manual del Dashboard Tote Bag

## Objetivo del dashboard

El dashboard centraliza la operación administrativa de Tote Bag. Su función es permitir que el equipo controle ventas, catálogo, clientes, personalizaciones, logística, compras, inventario, finanzas y auditoría desde un solo lugar.

En términos prácticos, el dashboard sirve para:

- revisar el estado general del negocio;
- atender pedidos y casos pendientes;
- mantener actualizado el catálogo;
- controlar cotizaciones corporativas y personalizaciones;
- registrar compras, recepciones y movimientos logísticos;
- monitorear flujo de caja, gastos, nómina y reportes contables;
- auditar cambios y administrar accesos.

## Vista general de acceso

El acceso depende del rol interno del usuario:

- `ADMIN`: puede entrar a todos los módulos.
- `MANAGER`: puede usar resumen, pedidos, productos, B2B, personalizaciones, PQRS, centro informativo y varios módulos logísticos.
- roles operativos privilegiados distintos de `ADMIN` y `MANAGER`: actualmente quedan limitados principalmente a `Pedidos` y `Productos`.

## Módulos del dashboard

### 1. Resumen

Ruta: `/dashboard`

Es la portada operativa del panel. Resume el estado del negocio en una sola vista.

Sirve para:

- ver pedidos del día;
- detectar acciones urgentes;
- revisar carga comercial;
- ver alertas de stock crítico;
- consultar indicadores rápidos de PQRS, envíos, personalizaciones y flujo financiero.

### 2. Pedidos

Ruta: `/dashboard/orders`

Es el centro de control comercial y operativo de las órdenes.

Sirve para:

- crear pedidos manualmente;
- hacer seguimiento al ciclo del pedido;
- revisar pagos pendientes;
- controlar pedidos en producción;
- coordinar la salida del pedido hacia logística.

### 3. Productos

Ruta: `/dashboard/products`

Administra el catálogo y la configuración técnica del producto.

Sirve para:

- crear y editar productos;
- actualizar precios, estados y datos del catálogo;
- organizar colecciones;
- administrar la configuración técnica del configurador;
- revisar la matriz de compatibilidad de materiales o telas.

Submódulos internos:

- `Catálogo`: listado principal de productos.
- `Colecciones`: agrupación comercial del catálogo.
- `Configuración técnica`: reglas internas del configurador.
- `Matriz de compatibilidad`: validación de combinaciones permitidas.

### 4. Clientes

Ruta: `/dashboard/customers`

Centraliza la gestión de clientes registrados.

Sirve para:

- consultar clientes por nombre, correo o ubicación;
- ver información de contacto y dirección;
- crear clientes manualmente;
- editar datos del cliente;
- activar o desactivar cuentas;
- revisar metadatos básicos del perfil.

### 5. Corporativo (B2B)

Ruta: `/dashboard/b2b`

Gestiona el canal de ventas corporativas y cotizaciones masivas.

Sirve para:

- revisar solicitudes corporativas;
- cotizar pedidos al por mayor;
- validar logos y diseños enviados por empresas;
- apoyar la aprobación comercial antes de producción;
- usar el simulador de precio B2B como apoyo comercial.

### 6. Personalizaciones

Ruta: `/dashboard/personalizaciones`

Administra solicitudes de diseño y personalización.

Sirve para:

- revisar configuraciones solicitadas por el cliente;
- validar artes y diseños;
- mover solicitudes entre estados;
- aprobar o frenar una personalización antes de liberar la compra final.

### 7. PQRS

Ruta: `/dashboard/pqrs`

Es la bandeja interna de peticiones, quejas, reclamos y sugerencias.

Sirve para:

- ver casos nuevos y en revisión;
- filtrar por estado;
- buscar por cliente, asunto o pedido relacionado;
- registrar respuesta interna;
- actualizar el estado del caso hasta su cierre.

### 8. Centro Informativo

Ruta: `/dashboard/conocimiento`

Funciona como centro de conocimiento interno del negocio.

Sirve para:

- publicar reglas comerciales;
- comunicar novedades internas;
- documentar lineamientos operativos;
- dejar información importante para ventas, operación y administración.

### 9. Dashboard Financiero

Ruta: `/dashboard/finanzas`

Es el módulo financiero más completo del panel.

Sirve para:

- ver KPIs financieros consolidados;
- revisar ingresos, gastos, compras y costo de ventas;
- analizar rentabilidad por período;
- ver cuentas por cobrar;
- revisar impuestos, retenciones y utilidad neta;
- configurar gastos fijos;
- medir avance hacia el punto de equilibrio;
- exportar reportes financieros en PDF.

### 10. Flujo de Caja

Ruta: `/dashboard/finanzas/cash-flow`

Monitorea la liquidez real del negocio.

Sirve para:

- comparar entradas vs salidas;
- ver saldo acumulado;
- analizar periodos de 30 días, 6 meses o año fiscal;
- detectar déficit o periodos positivos;
- revisar el impacto de ventas, compras, OpEx y COGS sobre la caja.

### 11. Gastos Operativos

Ruta: `/dashboard/finanzas/opex`

Controla egresos no directamente ligados a producción.

Sirve para:

- registrar gastos operativos;
- clasificar gastos por categoría;
- consultar ticket promedio y gasto mensual;
- revisar desglose por categoría;
- alimentar el análisis financiero general.

### 12. Nómina

Ruta: `/dashboard/finanzas/nomina`

Gestiona colaboradores, turnos y cuentas de cobro.

Sirve para:

- registrar trabajadores;
- registrar turnos y evidencias fotográficas;
- consolidar turnos en cuentas de cobro;
- cambiar estados de cuentas a enviada o pagada;
- descargar PDF de cuentas;
- revisar historial por trabajador.

### 13. Proveedores de Envío

Ruta: `/dashboard/logistica/proveedores`

Administra transportadoras o empresas de mensajería.

Sirve para:

- crear y editar proveedores logísticos;
- activar o desactivar transportadoras;
- guardar datos de contacto;
- dejar lista la base de proveedores para la operación de envíos.

### 14. Gestión de Envíos

Ruta: `/dashboard/logistica/envios`

Es el módulo operativo de despacho y devoluciones.

Sirve para:

- revisar la cola de envíos;
- ver pedidos pendientes, listos, enviados, en tránsito o entregados;
- asignar transportadora y guía;
- generar etiqueta;
- registrar consumo de bolsas de envío;
- monitorear excepciones operativas;
- procesar devoluciones;
- revisar trazabilidad de insumos consumidos por envío.

### 15. Proveedores de Insumos

Ruta: `/dashboard/logistica/insumos`

Administra proveedores de abastecimiento.

Sirve para:

- crear y editar proveedores;
- consultar contacto, NIT y saldo;
- ver lotes asociados;
- registrar pagos a proveedores;
- mantener control de cuentas por pagar del abastecimiento.

### 16. Pagos y Facturación

Ruta: `/dashboard/compras/facturacion`

Gestiona obligaciones financieras con proveedores.

Sirve para:

- crear facturas de compra;
- editar facturas;
- registrar abonos;
- adjuntar comprobantes de pago;
- revisar saldo pendiente por factura;
- ver historial de soportes por proveedor o factura.

### 17. Recepción de Lotes

Ruta: `/dashboard/compras/recepcion`

Registra el ingreso físico de mercancía o insumos.

Sirve para:

- registrar recepciones de producto vendible, insumo, herramienta u otros;
- asociar proveedor y soporte documental;
- registrar costos unitarios y flete;
- crear insumos nuevos desde el mismo flujo;
- dejar trazado el lote de entrada para inventario FIFO.

### 18. Inventario FIFO

Ruta: `/dashboard/logistica/inventario`

Controla el inventario valorizado por capas de costo FIFO.

Sirve para:

- revisar stock físico, comprometido y disponible;
- ver costo promedio y valor del inventario;
- revisar lotes activos por producto;
- detectar alertas de reabastecimiento;
- consultar movimientos recientes de inventario;
- identificar lotes estancados.

### 19. Salidas no comerciales

Ruta: `/dashboard/logistica/inventario/salidas-no-comerciales`

Registra descuentos de stock que no generan venta.

Sirve para:

- descontar inventario por regalos;
- registrar muestras;
- cargar pruebas internas;
- registrar uso operativo;
- mantener trazabilidad administrativa de cualquier salida sin ingreso.

### 20. Precios y Márgenes

Ruta: `/dashboard/strategy/pricing`

Es un simulador estratégico de rentabilidad.

Sirve para:

- calcular precios de venta;
- estimar margen sobre recaudo neto;
- evaluar impacto de Wompi, IVA, CIF y retenciones;
- definir si un producto está en estrategia premium, comercial o de volumen.

Importante:

- este módulo es un simulador;
- no publica automáticamente reglas de precio al catálogo.

### 21. Reportes Contables

Ruta: `/dashboard/reportes`

Está enfocado en cierre y exportación contable.

Sirve para:

- generar estados de resultados;
- revisar ingresos, COGS, OpEx e impuestos del período;
- valorar inventario como activo;
- exportar reportes en Excel y PDF;
- apoyar el cierre administrativo mensual o acumulado.

Acceso:

- solo `ADMIN`.

### 22. Auditoría

Ruta: `/dashboard/audit`

Es el registro histórico de acciones del sistema.

Sirve para:

- ver quién creó, editó o eliminó datos;
- filtrar por entidad y acción;
- revisar IP, usuario y contexto técnico;
- comparar valor anterior vs valor nuevo;
- investigar cambios en pedidos, productos, proveedores, envíos, nómina y otros módulos.

### 23. Configuración

Rutas:

- `/dashboard/settings`
- `/dashboard/settings/users`

Administra la configuración del usuario y, en caso de admin, la gestión de roles.

#### Perfil

Ruta: `/dashboard/settings`

Sirve para:

- actualizar nombre, teléfono y dirección;
- mantener departamento, municipio y barrio;
- revisar el correo asociado a la cuenta.

#### Usuarios y Roles

Ruta: `/dashboard/settings/users`

Sirve para:

- ver usuarios del sistema;
- buscar por correo o nombre;
- cambiar roles entre `ADMIN`, `MANAGER` y `CUSTOMER`;
- controlar accesos internos.

Acceso:

- solo `ADMIN`.

## Flujo operativo recomendado

### Inicio de jornada

1. Abrir `Resumen` para detectar alertas y carga del día.
2. Revisar `Pedidos`, `PQRS` y `Gestión de Envíos`.
3. Validar `Personalizaciones` y `B2B` si hay pendientes comerciales.

### Operación diaria

1. Registrar nuevas compras en `Recepción de Lotes`.
2. Actualizar pagos y saldos en `Pagos y Facturación`.
3. Confirmar disponibilidad y alertas en `Inventario FIFO`.
4. Registrar gastos en `Gastos Operativos` y novedades de `Nómina`.

### Cierre y control

1. Revisar `Dashboard Financiero` y `Flujo de Caja`.
2. Exportar `Reportes Contables` cuando corresponda.
3. Validar cambios sensibles en `Auditoría`.

## Relación entre módulos

- `Pedidos` se conecta con `Gestión de Envíos`, `Inventario FIFO`, `Flujo de Caja` y `Reportes`.
- `Recepción de Lotes` alimenta `Inventario FIFO`.
- `Pagos y Facturación` y `Proveedores de Insumos` alimentan finanzas y cuentas por pagar.
- `Salidas no comerciales` impacta inventario sin pasar por ventas.
- `Nómina`, `OpEx` y compras impactan el `Dashboard Financiero`.
- `Auditoría` sirve como capa de control transversal para casi todos los módulos.

## Observaciones importantes

- El dashboard no es solo visual; varios módulos escriben información crítica del negocio.
- Los módulos financieros y contables deben usarse con roles adecuados.
- Algunos permisos cambian por rol y no todos los usuarios verán el mismo menú.
- La estructura de este manual fue levantada con base en la navegación y páginas actuales del proyecto.

## Fuentes internas del proyecto

La navegación principal y los módulos descritos aquí están alineados con:

- `apps/web/components/dashboard/Sidebar.tsx`
- `apps/web/lib/frontend-routing.ts`
- `apps/web/app/dashboard/**`
