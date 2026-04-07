# Definicion Tecnica del Modulo de Nomina

Fecha: 2026-03-16

## Estado actual

El modulo de nomina en `apps/web/app/dashboard/finanzas/nomina/page.tsx` hoy opera solo en cliente.

Capacidades actuales:
- registrar turnos
- editar y eliminar turnos
- adjuntar foto de entrada y salida
- consolidar turnos pendientes en cuentas de cobro
- cambiar estado de cuenta de cobro
- consultar historial por colaborador

Limitaciones actuales:
- usa `localStorage` como persistencia principal
- arranca con `sampleTurnos`
- no tiene backend ni modelo en base de datos
- no genera transacciones financieras reales
- no genera PDF real desde backend
- no tiene trazabilidad multiusuario ni auditoria real

## Alcance funcional recomendado

El modulo debe cubrir solo este flujo operativo:

1. Registrar turnos por colaborador.
2. Adjuntar soportes de entrada y salida.
3. Consolidar turnos en una cuenta de cobro por periodo.
4. Marcar cuentas como `PENDIENTE`, `ENVIADA` o `PAGADA`.
5. Registrar el pago como transaccion financiera `PAYROLL`.
6. Consultar historial por colaborador y por cuenta.
7. Exportar PDF de cuenta de cobro desde backend.

Queda fuera del alcance minimo:
- liquidacion laboral completa
- prestaciones sociales
- seguridad social
- deducciones avanzadas
- integracion contable externa

## Frontera con Finanzas

Nomina no debe mezclarse con el formulario manual de OpEx.

Regla propuesta:
- `Nomina` administra `turnos`, `cuentas de cobro` y `pagos`.
- `Finanzas` solo consume el resultado final a traves de `financial_transactions` con categoria `PAYROLL`.

Consecuencia:
- crear o editar un turno no crea transaccion financiera
- marcar una cuenta como `PAGADA` si debe crear una transaccion `PAYROLL`
- el dashboard financiero y reportes leen esa transaccion consolidada, no los turnos individuales

## Modelo minimo de dominio

### PayrollWorker

Representa al colaborador operativo.

Campos minimos:
- `id`
- `fullName`
- `documentNumber`
- `phone`
- `email`
- `isActive`
- `createdAt`
- `updatedAt`

### PayrollShift

Representa un turno trabajado.

Campos minimos:
- `id`
- `workerId`
- `workDate`
- `startTime`
- `endTime`
- `breakMinutes`
- `hourlyRate`
- `totalAmount`
- `notes`
- `entryPhotoUrl`
- `exitPhotoUrl`
- `billingStatementId` nullable
- `createdBy`
- `createdAt`
- `updatedAt`

### PayrollBillingStatement

Representa una cuenta de cobro consolidada.

Campos minimos:
- `id`
- `statementNumber`
- `workerId` nullable
- `status` enum `PENDIENTE | ENVIADA | PAGADA`
- `periodStart`
- `periodEnd`
- `totalAmount`
- `sentAt` nullable
- `paidAt` nullable
- `paymentTransactionId` nullable
- `createdBy`
- `createdAt`
- `updatedAt`

### PayrollBillingStatementItem

Relacion entre cuenta y turnos.

Campos minimos:
- `id`
- `billingStatementId`
- `shiftId`
- `amount`

## Endpoints minimos requeridos

Base sugerida: `/api/v1/payroll`

Workers:
- `GET /workers`
- `POST /workers`
- `PATCH /workers/:id`

Shifts:
- `GET /shifts`
- `POST /shifts`
- `PATCH /shifts/:id`
- `DELETE /shifts/:id`

Statements:
- `GET /statements`
- `POST /statements/consolidate`
- `GET /statements/:id`
- `PATCH /statements/:id/status`
- `GET /statements/:id/pdf`

History:
- `GET /workers/:id/history`

## Reglas operativas minimas

- Un turno pagado no se puede editar sin reabrir la cuenta asociada.
- Un turno no puede pertenecer a mas de una cuenta de cobro.
- La consolidacion debe ser idempotente para el mismo conjunto de turnos.
- El cambio a `PAGADA` debe exigir usuario autenticado y fecha de pago.
- El cambio a `PAGADA` crea una `financial_transaction` de tipo `EXPENSE` y categoria `PAYROLL`.
- Los soportes fotograficos deben almacenarse en storage, no en base64 dentro del navegador.

## Integraciones necesarias

- `StorageModule` para fotos de entrada/salida
- `Inventory/FinanceService` o un servicio financiero dedicado para crear la transaccion `PAYROLL`
- `AuditModule` para registrar consolidacion, envio y pago

## Decision recomendada

Recomendacion: retirar temporalmente el acceso publico del modulo desde la navegacion hasta que exista persistencia real.

Motivo:
- hoy la UI parece operativa pero no lo es a nivel multiusuario ni financiero
- mantenerla visible aumenta riesgo de uso real sobre datos locales
- ocultarla temporalmente no rompe finanzas existentes porque hoy no hay integracion real

Condicion para volver a publicarla:
- persistencia backend lista
- transaccion `PAYROLL` integrada
- PDF real disponible
- pruebas minimas de `payroll`

## Ruta de implementacion recomendada

Fase 1:
- crear modulo `payroll` en API
- definir tablas Prisma
- exponer CRUD minimo de workers y shifts

Fase 2:
- consolidar cuentas de cobro
- integrar storage para soportes
- agregar historial por colaborador

Fase 3:
- crear transaccion `PAYROLL` al marcar cuenta como pagada
- exponer PDF real
- volver a habilitar la ruta en sidebar
