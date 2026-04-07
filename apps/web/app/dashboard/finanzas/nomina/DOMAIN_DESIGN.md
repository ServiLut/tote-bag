# Diseno de Dominio: Nomina

Fecha: 2026-03-17

## Objetivo

Formalizar el modelo minimo de nomina para que el rol `ADMIN` tenga control total del modulo sin afectar otros dominios del sistema.

Este diseno reemplaza el uso de `collaborator` como texto libre por una entidad real de trabajador, agrega tarifa por hora individual, persiste la tarifa aplicada por turno y define reglas de estados y trazabilidad.

## Alcance

El cambio debe quedarse dentro del modulo `payroll`:

- Prisma payroll
- API payroll
- UI `dashboard/finanzas/nomina`
- pruebas de payroll

No debe modificar la logica global de auth, storage ni otros modulos funcionales.

## Entidades

### 1. PayrollWorker

Representa a cada empleado o colaborador administrado por nomina.

Campos propuestos:

- `id: Int`
- `displayName: String`
- `documentNumber: String`
- `phone: String?`
- `email: String?`
- `workerType: PayrollWorkerType`
- `roleName: String?`
- `hourlyRate: Float`
- `isActive: Boolean`
- `notes: String`
- `createdAt: DateTime`
- `updatedAt: DateTime`
- `createdByUserId: String?`
- `updatedByUserId: String?`

Relaciones:

- `shifts: PayrollShift[]`
- `billingStatements: PayrollBillingStatement[]`

Reglas:

- `documentNumber` debe ser unico.
- `hourlyRate` debe ser mayor o igual a `0`.
- un trabajador inactivo no debe poder recibir nuevos turnos.
- el cambio de tarifa afecta solo turnos nuevos; nunca recalcula turnos historicos.

Enum propuesto:

- `EMPLOYEE`
- `CONTRACTOR`
- `TEMPORARY`
- `OTHER`

### 2. PayrollShift

Representa un turno trabajado por una persona concreta.

Campos propuestos:

- `id: Int`
- `workerId: Int`
- `legacyCollaborator: String?`
- `workDate: DateTime`
- `startTime: String`
- `endTime: String`
- `breakMinutes: Int`
- `notes: String`
- `hourlyRateApplied: Float`
- `totalAmount: Float`
- `status: PayrollShiftStatus`
- `entryPhotoUrl: String?`
- `exitPhotoUrl: String?`
- `billingStatementId: Int?`
- `createdAt: DateTime`
- `updatedAt: DateTime`
- `createdByUserId: String?`
- `updatedByUserId: String?`

Relaciones:

- `worker: PayrollWorker`
- `billingStatement: PayrollBillingStatement?`

Reglas:

- `totalAmount` debe calcularse en backend.
- `hourlyRateApplied` se toma del `PayrollWorker.hourlyRate` al momento de crear el turno.
- si el turno ya esta consolidado, no se puede editar ni eliminar por flujo normal.
- `status` no debe depender solo de `billingStatementId`; debe quedar persistido.
- `legacyCollaborator` se mantiene solo para compatibilidad y migracion si hace falta.

Enum propuesto:

- `RECORDED`
- `BILLED`
- `PAID`
- `CANCELLED`

Estados derivados esperados:

- al crear turno: `RECORDED`
- al consolidar en cuenta: `BILLED`
- al pagar la cuenta: `PAID`
- anulacion administrativa: `CANCELLED`

### 3. PayrollBillingStatement

Representa la cuenta de cobro o lote consolidado de un trabajador para un periodo.

Campos propuestos:

- `id: Int`
- `workerId: Int`
- `statementNumber: String?`
- `legacyCollaborator: String?`
- `periodStart: DateTime`
- `periodEnd: DateTime`
- `totalAmount: Float`
- `status: PayrollStatementStatus`
- `paymentTransactionId: String?`
- `sentAt: DateTime?`
- `paidAt: DateTime?`
- `createdAt: DateTime`
- `updatedAt: DateTime`
- `createdByUserId: String?`
- `updatedByUserId: String?`
- `sentByUserId: String?`
- `paidByUserId: String?`

Relaciones:

- `worker: PayrollWorker`
- `shifts: PayrollShift[]`

Reglas:

- una cuenta pertenece a un solo trabajador.
- una cuenta se consolida con uno o varios turnos del mismo trabajador.
- el total de la cuenta es la suma de los `totalAmount` de sus turnos.
- `paymentTransactionId` se crea solo una vez al pasar a `PAGADA`.

## Relaciones

- `PayrollWorker 1 -> N PayrollShift`
- `PayrollWorker 1 -> N PayrollBillingStatement`
- `PayrollBillingStatement 1 -> N PayrollShift`

## Reglas de negocio

### Tarifa por hora

- la tarifa es individual por trabajador.
- el `ADMIN` debe poder crear y editar esa tarifa.
- el frontend puede mostrar una estimacion, pero la fuente de verdad es backend.
- al guardar un turno, backend debe:
  - cargar el trabajador
  - tomar su tarifa vigente
  - calcular minutos trabajados
  - persistir `hourlyRateApplied`
  - persistir `totalAmount`

### Validaciones de turno

- `endTime` no puede ser menor o igual a `startTime` en la primera version.
- `breakMinutes` no puede ser negativo.
- `breakMinutes` no puede ser mayor o igual al tiempo total del turno.
- no se debe permitir registrar turnos para trabajadores inactivos.

### Consolidacion

- la consolidacion debe hacerse por `workerId`.
- no se deben mezclar trabajadores en una misma cuenta.
- solo se consolidan turnos `RECORDED` sin `billingStatementId`.
- al consolidar:
  - se crea la cuenta
  - los turnos cambian a `BILLED`
  - los turnos quedan asociados a la cuenta

### Pago

Flujo permitido:

- `PENDIENTE -> ENVIADA`
- `ENVIADA -> PAGADA`

Restricciones:

- no debe permitirse `PENDIENTE -> PAGADA` en flujo normal.
- no debe permitirse crear dos transacciones para la misma cuenta.
- al pasar a `PAGADA`:
  - se crea `FinancialTransaction`
  - se guarda `paymentTransactionId`
  - se guarda `paidAt`
  - se guarda `paidByUserId`
  - los turnos asociados pasan a `PAID`

### Edicion y anulacion

- turno `RECORDED`: editable y eliminable.
- turno `BILLED`: no editable ni eliminable.
- turno `PAID`: no editable ni eliminable.
- cuenta `PENDIENTE`: editable solo por acciones administrativas definidas.
- cuenta `ENVIADA`: no debe permitir recomposicion de turnos sin reapertura controlada.
- cuenta `PAGADA`: no debe permitir cambios sin un flujo futuro de ajuste o anulacion.

## Trazabilidad minima

Se deben persistir actores administrativos en payroll:

- `createdByUserId`
- `updatedByUserId`
- `sentByUserId`
- `paidByUserId`

Y conservar timestamps:

- `createdAt`
- `updatedAt`
- `sentAt`
- `paidAt`

## Compatibilidad y migracion

Para no romper el payroll actual durante la transicion:

- se puede mantener temporalmente `collaborator` o migrarlo a `legacyCollaborator`.
- el frontend de nomina debe migrar de nombre libre a selector de trabajador.
- los endpoints actuales pueden mantenerse mientras se agregan nuevos campos requeridos.
- la consolidacion debe dejar de operar sobre "todos los pendientes" y pasar a recibir `workerId` y `shiftIds` consistentes.

## Endpoints objetivo

### Workers

- `GET /payroll/workers`
- `POST /payroll/workers`
- `PATCH /payroll/workers/:id`

### Shifts

- `GET /payroll/shifts`
- `POST /payroll/shifts`
- `PATCH /payroll/shifts/:id`
- `DELETE /payroll/shifts/:id`

Payload objetivo de turno:

- `workerId`
- `workDate`
- `startTime`
- `endTime`
- `breakMinutes`
- `notes`
- `entryPhoto`
- `exitPhoto`

### Statements

- `GET /payroll/statements`
- `POST /payroll/statements/consolidate`
- `GET /payroll/statements/:id`
- `PATCH /payroll/statements/:id/status`
- `GET /payroll/statements/:id/pdf`

Payload objetivo de consolidacion:

- `workerId`
- `shiftIds`

## Decision cerrada para la siguiente fase

La siguiente implementacion debe basarse en estas decisiones:

- introducir `PayrollWorker`
- mover la tarifa al trabajador
- persistir `hourlyRateApplied` por turno
- consolidar por trabajador
- endurecer estados y trazabilidad
- mantener integracion financiera existente solo al momento de pago
