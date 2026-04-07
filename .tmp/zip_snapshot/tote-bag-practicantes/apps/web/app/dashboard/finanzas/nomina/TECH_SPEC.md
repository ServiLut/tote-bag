# Alcance Técnico Mínimo: Nómina

## Estado actual

El módulo actual de nómina en [page.tsx](./page.tsx) es un cliente puro. No consume API ni base de datos; carga y persiste datos en `localStorage` usando `dashboard-payroll-turnos` y `dashboard-payroll-cuentas`.

### Capacidades reales hoy

- Registro manual de turnos.
- Edición y eliminación de turnos.
- Cálculo local del valor del turno con una tarifa fija `HOURLY_RATE = 12000`.
- Carga local de foto de llegada y foto de salida como `data URL`.
- Consolidación manual de turnos pendientes en una cuenta de cobro.
- Cambio manual del estado de la cuenta de cobro: `PENDIENTE`, `ENVIADA`, `PAGADA`.
- Vista de detalle por cuenta.
- Vista de historial por colaborador.
- KPIs locales: turnos registrados, pendientes de cobro, cuentas activas y nómina pendiente.

### Limitaciones actuales

- Arranca con `sampleTurnos`; no hay fuente real de datos.
- No existe identidad persistente de colaborador.
- No existe relación con usuarios, perfiles o proveedores.
- No existe trazabilidad de quién creó, editó, consolidó o pagó.
- Las fotos no se suben a storage; quedan embebidas en el navegador.
- La exportación PDF está pendiente y hoy solo muestra un mensaje.
- No hay integración con finanzas más allá del concepto general de categoría `PAYROLL`.

## Datos que maneja hoy

### Turno

- `id`
- `colaborador`
- `fecha`
- `horaEntrada`
- `horaSalida`
- `tiempoDescanso`
- `observaciones`
- `valorTotal`
- `cuentaCobroId`
- `fotoEntrada`
- `fotoSalida`

### Cuenta de cobro

- `id`
- `colaborador`
- `fechaInicio`
- `fechaFin`
- `valorTotal`
- `estado`
- `createdAt`
- `turnosIds`

## Dependencias implícitas

Aunque no están integradas todavía, el módulo asume estas dependencias de negocio:

- Existe una tarifa o regla de cálculo por hora.
- Existe un concepto de colaborador externo o temporal que puede facturar por turnos.
- Existe un flujo administrativo de consolidación y pago.
- Existe relación con finanzas, porque el backend ya usa `TransactionCategory.PAYROLL` en [finance.service.ts](../../../../../api/src/modules/inventory/finance.service.ts).
- Existe necesidad de evidencia operativa mediante fotos de entrada y salida.

## Qué debe persistirse sí o sí si el módulo se vuelve real

### 1. Colaborador

Debe existir una entidad persistida para evitar depender del nombre libre.

Campos mínimos:

- `id`
- `displayName`
- `documentNumber` o identificador tributario
- `phone`
- `email`
- `isActive`

### 2. Turno

Es la unidad base del módulo y debe persistirse completa.

Campos mínimos:

- `id`
- `workerId`
- `workDate`
- `startTime`
- `endTime`
- `breakMinutes`
- `notes`
- `hourlyRateApplied`
- `totalAmount`
- `status`
- `billingBatchId`
- `createdAt`
- `updatedAt`
- `createdByUserId`

Estado mínimo recomendado:

- `DRAFT`
- `RECORDED`
- `BILLED`
- `PAID`
- `CANCELLED`

### 3. Evidencias del turno

Las fotos no pueden seguir como `data URL` local.

Persistencia mínima:

- `arrivalEvidenceUrl`
- `departureEvidenceUrl`
- `arrivalCapturedAt`
- `departureCapturedAt`

Idealmente en storage externo ya existente, no dentro de la fila principal.

### 4. Cuenta de cobro / lote de facturación

La consolidación manual actual debe representarse como entidad propia.

Campos mínimos:

- `id`
- `workerId` o criterio explícito de consolidación
- `periodStart`
- `periodEnd`
- `totalAmount`
- `status`
- `createdAt`
- `sentAt`
- `paidAt`
- `createdByUserId`

Estado mínimo recomendado:

- `PENDING`
- `SENT`
- `PAID`
- `VOID`

### 5. Relación cuenta-turno

Aunque hoy se resuelve con `turnosIds`, si el módulo crece conviene que la relación sea persistida de forma explícita.

Mínimo:

- `billingBatchId` en `Turno`

Si se quiere más trazabilidad:

- tabla pivote `PayrollBatchShift`

### 6. Movimiento financiero asociado al pago

Si una cuenta cambia a `PAGADA`, debe quedar trazabilidad financiera real.

Opciones mínimas:

- crear `FinancialTransaction` con `category = PAYROLL`
- guardar referencia a `billingBatchId`

Esto evita que nómina y finanzas se desalineen.

## Qué no debe bloquear la primera versión real

Puede diferirse sin romper el núcleo:

- PDF final de cuenta de cobro
- historial avanzado por colaborador
- cálculo variable por tarifas o recargos
- aprobaciones multinivel
- OCR o validación automática de fotos

## Endpoints mínimos recomendados

### Turnos

- `POST /payroll/shifts`
- `GET /payroll/shifts`
- `PATCH /payroll/shifts/:id`
- `DELETE /payroll/shifts/:id`

### Cuentas de cobro

- `POST /payroll/batches`
- `GET /payroll/batches`
- `GET /payroll/batches/:id`
- `PATCH /payroll/batches/:id/status`

### Colaboradores

- `GET /payroll/workers`
- `POST /payroll/workers`

## Decisión recomendada

No conviene conectar la pantalla actual directamente a backend "tal como está". Primero debe existir un módulo backend mínimo de nómina con persistencia de:

- colaborador
- turno
- cuenta de cobro
- evidencias
- vínculo financiero al marcar pago

Hasta que eso exista, la pantalla actual debe considerarse prototipo operativo interno, no módulo empresarial real.
