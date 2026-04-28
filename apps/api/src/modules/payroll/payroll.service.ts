import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollShiftStatus,
  PayrollStatementStatus,
  PayrollWorkerType,
  TransactionCategory,
  TransactionType,
} from '../../generated/client/client';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsolidatePayrollStatementDto } from './dto/consolidate-payroll-statement.dto';
import { CreatePayrollShiftDto } from './dto/create-payroll-shift.dto';
import { CreatePayrollWorkerDto } from './dto/create-payroll-worker.dto';
import { UpdatePayrollStatementStatusDto } from './dto/update-payroll-statement-status.dto';
import { UpdatePayrollShiftDto } from './dto/update-payroll-shift.dto';
import { UpdatePayrollWorkerDto } from './dto/update-payroll-worker.dto';
import { decimalToNumber } from '../../common/utils/sales-tax.util';

type PayrollShiftFiles = {
  entryPhoto?: Express.Multer.File[];
  exitPhoto?: Express.Multer.File[];
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getWorkers() {
    return this.prisma.payrollWorker.findMany({
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    });
  }

  async getShifts() {
    return this.prisma.payrollShift.findMany({
      include: {
        worker: true,
      },
      orderBy: [{ workDate: 'desc' }, { id: 'desc' }],
    });
  }

  async getStatements() {
    return this.prisma.payrollBillingStatement.findMany({
      include: {
        worker: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async getStatementById(id: number) {
    const statement = await this.prisma.payrollBillingStatement.findUnique({
      where: { id },
      include: {
        worker: true,
        shifts: {
          include: {
            worker: true,
          },
          orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!statement) {
      throw new NotFoundException('Cuenta de cobro no encontrada');
    }

    return statement;
  }

  async getWorkerHistory(workerId: number) {
    const worker = await this.prisma.payrollWorker.findUnique({
      where: { id: workerId },
      include: {
        shifts: {
          orderBy: [{ workDate: 'desc' }, { id: 'desc' }],
        },
        billingStatements: {
          include: {
            shifts: {
              orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });

    if (!worker) {
      throw new NotFoundException('Trabajador no encontrado');
    }

    return worker;
  }

  async getStatementWithShifts(id: number) {
    const statement = await this.prisma.payrollBillingStatement.findUnique({
      where: { id },
      include: {
        worker: true,
        shifts: {
          include: {
            worker: true,
          },
          orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!statement) {
      throw new NotFoundException('Cuenta de cobro no encontrada');
    }

    return statement;
  }

  async createWorker(dto: CreatePayrollWorkerDto, userId: string) {
    return this.prisma.payrollWorker.create({
      data: {
        displayName: dto.displayName.trim(),
        documentNumber: dto.documentNumber.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        workerType: dto.workerType ?? PayrollWorkerType.CONTRACTOR,
        roleName: dto.roleName?.trim() || null,
        hourlyRate: dto.hourlyRate,
        notes: dto.notes?.trim() || '',
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  async updateWorker(id: number, dto: UpdatePayrollWorkerDto, userId: string) {
    const existingWorker = await this.prisma.payrollWorker.findUnique({
      where: { id },
    });

    if (!existingWorker) {
      throw new NotFoundException('Trabajador no encontrado');
    }

    if (dto.isActive === false && existingWorker.isActive) {
      const openShiftCount = await this.prisma.payrollShift.count({
        where: {
          workerId: id,
          status: {
            in: [PayrollShiftStatus.RECORDED, PayrollShiftStatus.BILLED],
          },
        },
      });

      if (openShiftCount > 0) {
        throw new BadRequestException(
          'No se puede inactivar un trabajador con turnos abiertos o pendientes de pago',
        );
      }
    }

    return this.prisma.payrollWorker.update({
      where: { id },
      data: {
        displayName: dto.displayName?.trim() ?? existingWorker.displayName,
        documentNumber:
          dto.documentNumber?.trim() ?? existingWorker.documentNumber,
        phone:
          dto.phone === undefined
            ? existingWorker.phone
            : dto.phone?.trim() || null,
        email:
          dto.email === undefined
            ? existingWorker.email
            : dto.email?.trim().toLowerCase() || null,
        workerType: dto.workerType ?? existingWorker.workerType,
        roleName:
          dto.roleName === undefined
            ? existingWorker.roleName
            : dto.roleName?.trim() || null,
        hourlyRate: dto.hourlyRate ?? existingWorker.hourlyRate,
        notes:
          dto.notes === undefined
            ? existingWorker.notes
            : dto.notes?.trim() || '',
        isActive: dto.isActive ?? existingWorker.isActive,
        updatedByUserId: userId,
      },
    });
  }

  async deleteWorker(id: number) {
    const existingWorker = await this.prisma.payrollWorker.findUnique({
      where: { id },
    });

    if (!existingWorker) {
      throw new NotFoundException('Trabajador no encontrado');
    }

    const [shiftCount, statementCount] = await Promise.all([
      this.prisma.payrollShift.count({
        where: { workerId: id },
      }),
      this.prisma.payrollBillingStatement.count({
        where: { workerId: id },
      }),
    ]);

    if (shiftCount > 0 || statementCount > 0) {
      throw new BadRequestException(
        'No se puede eliminar el trabajador porque tiene turnos o cuentas asociados',
      );
    }

    return this.prisma.payrollWorker.delete({
      where: { id },
    });
  }

  async createShift(
    dto: CreatePayrollShiftDto,
    files: PayrollShiftFiles = {},
    userId?: string,
  ) {
    const entryPhotoUrl = await this.uploadShiftPhoto(
      files.entryPhoto?.[0],
      'entry',
    );
    const exitPhotoUrl = await this.uploadShiftPhoto(
      files.exitPhoto?.[0],
      'exit',
    );

    const shiftPayload = await this.resolveShiftPayload(dto);
    await this.ensureShiftHasNoConflict({
      workerId: shiftPayload.workerId,
      workDate: dto.workDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    return this.prisma.payrollShift.create({
      data: {
        collaborator: shiftPayload.collaborator,
        workerId: shiftPayload.workerId,
        workDate: new Date(dto.workDate),
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakMinutes: dto.breakMinutes ?? 0,
        notes: dto.notes ?? '',
        hourlyRateApplied: shiftPayload.hourlyRateApplied,
        totalAmount: shiftPayload.totalAmount,
        status: PayrollShiftStatus.RECORDED,
        entryPhotoUrl,
        exitPhotoUrl,
        createdByUserId: userId ?? null,
        updatedByUserId: userId ?? null,
      },
      include: {
        worker: true,
      },
    });
  }

  async updateShift(
    id: number,
    dto: UpdatePayrollShiftDto,
    files: PayrollShiftFiles = {},
    userId?: string,
  ) {
    const existingShift = await this.prisma.payrollShift.findUnique({
      where: { id },
      include: {
        worker: true,
      },
    });

    if (!existingShift) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (existingShift.billingStatementId) {
      throw new BadRequestException(
        'No se puede editar un turno ya consolidado en una cuenta de cobro',
      );
    }

    if (
      existingShift.status === PayrollShiftStatus.BILLED ||
      existingShift.status === PayrollShiftStatus.PAID
    ) {
      throw new BadRequestException(
        'No se puede editar un turno facturado o pagado',
      );
    }

    const entryPhotoUrl =
      (await this.uploadShiftPhoto(files.entryPhoto?.[0], 'entry')) ??
      existingShift.entryPhotoUrl;
    const exitPhotoUrl =
      (await this.uploadShiftPhoto(files.exitPhoto?.[0], 'exit')) ??
      existingShift.exitPhotoUrl;

    const mergedDto: CreatePayrollShiftDto = {
      workerId: dto.workerId ?? existingShift.workerId ?? undefined,
      collaborator: dto.collaborator ?? existingShift.collaborator,
      workDate: dto.workDate ?? existingShift.workDate.toISOString(),
      startTime: dto.startTime ?? existingShift.startTime,
      endTime: dto.endTime ?? existingShift.endTime,
      breakMinutes: dto.breakMinutes ?? existingShift.breakMinutes,
      notes: dto.notes ?? existingShift.notes,
      totalAmount:
        dto.totalAmount ?? decimalToNumber(existingShift.totalAmount),
    };

    const shiftPayload = await this.resolveShiftPayload(mergedDto);
    await this.ensureShiftHasNoConflict({
      workerId: shiftPayload.workerId,
      workDate: mergedDto.workDate,
      startTime: mergedDto.startTime,
      endTime: mergedDto.endTime,
      ignoreShiftId: id,
    });

    return this.prisma.payrollShift.update({
      where: { id },
      data: {
        collaborator: shiftPayload.collaborator,
        workerId: shiftPayload.workerId,
        workDate: new Date(mergedDto.workDate),
        startTime: mergedDto.startTime,
        endTime: mergedDto.endTime,
        breakMinutes: mergedDto.breakMinutes ?? 0,
        notes: mergedDto.notes ?? '',
        hourlyRateApplied: shiftPayload.hourlyRateApplied,
        totalAmount: shiftPayload.totalAmount,
        entryPhotoUrl,
        exitPhotoUrl,
        updatedByUserId: userId ?? existingShift.updatedByUserId,
      },
      include: {
        worker: true,
      },
    });
  }

  async deleteShift(id: number) {
    const shift = await this.prisma.payrollShift.findUnique({
      where: { id },
    });

    if (!shift) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (shift.billingStatementId) {
      throw new BadRequestException(
        'No se puede eliminar un turno ya consolidado en una cuenta de cobro',
      );
    }

    return this.prisma.payrollShift.delete({
      where: { id },
    });
  }

  async consolidateStatement(
    dto: ConsolidatePayrollStatementDto = {},
    userId?: string,
  ) {
    if (!dto.workerId) {
      throw new BadRequestException(
        'Debe indicar el trabajador para consolidar la cuenta de cobro',
      );
    }

    const where = dto.shiftIds?.length
      ? { id: { in: dto.shiftIds }, billingStatementId: null }
      : {
          billingStatementId: null,
          workerId: dto.workerId,
        };

    const shifts = await this.prisma.payrollShift.findMany({
      where,
      include: {
        worker: true,
      },
      orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
    });

    if (shifts.length === 0) {
      throw new BadRequestException('No hay turnos pendientes para consolidar');
    }

    if (dto.shiftIds?.length && shifts.length !== dto.shiftIds.length) {
      throw new BadRequestException(
        'Uno o mas turnos ya fueron consolidados o no existen',
      );
    }

    const workerIds = Array.from(
      new Set(shifts.map((shift) => shift.workerId)),
    );
    if (workerIds.some((workerId) => workerId !== dto.workerId)) {
      throw new BadRequestException(
        'Los turnos no pertenecen al trabajador indicado',
      );
    }

    if (workerIds.includes(null)) {
      throw new BadRequestException(
        'No se pueden consolidar turnos sin trabajador asignado',
      );
    }

    const collaboratorNames = Array.from(
      new Set(
        shifts.map((shift) => shift.worker?.displayName || shift.collaborator),
      ),
    ).filter(Boolean);
    if (collaboratorNames.length !== 1) {
      throw new BadRequestException(
        'No se pueden consolidar turnos de multiples trabajadores en una sola cuenta',
      );
    }

    const worker = shifts[0].worker;
    if (!worker) {
      throw new BadRequestException(
        'No se pueden consolidar turnos sin trabajador persistido',
      );
    }

    const collaborator = collaboratorNames[0];
    const totalAmount = shifts.reduce(
      (sum, shift) => sum + decimalToNumber(shift.totalAmount),
      0,
    );
    const periodStart = shifts[0].workDate;
    const periodEnd = shifts[shifts.length - 1].workDate;

    return this.prisma.$transaction(async (tx) => {
      const statement = await tx.payrollBillingStatement.create({
        data: {
          collaborator,
          workerId: dto.workerId,
          periodStart,
          periodEnd,
          totalAmount,
          createdByUserId: userId ?? null,
          updatedByUserId: userId ?? null,
        },
      });

      const statementNumber = `NOM-${String(statement.id).padStart(6, '0')}`;

      await tx.payrollBillingStatement.update({
        where: { id: statement.id },
        data: {
          statementNumber,
        },
      });

      await tx.payrollShift.updateMany({
        where: {
          id: {
            in: shifts.map((shift) => shift.id),
          },
        },
        data: {
          billingStatementId: statement.id,
          status: PayrollShiftStatus.BILLED,
          updatedByUserId: userId ?? null,
        },
      });

      return statement;
    });
  }

  async updateStatementStatus(
    id: number,
    dto: UpdatePayrollStatementStatusDto,
    userId: string,
  ) {
    const statement = await this.prisma.payrollBillingStatement.findUnique({
      where: { id },
      include: {
        shifts: true,
      },
    });

    if (!statement) {
      throw new NotFoundException('Cuenta de cobro no encontrada');
    }

    return this.prisma.$transaction(async (tx) => {
      this.assertStatementStatusTransition(statement.status, dto.status);

      let paymentTransactionId = statement.paymentTransactionId;
      let paidAt = statement.paidAt;
      let sentAt = statement.sentAt;
      let sentByUserId = statement.sentByUserId;
      let paidByUserId = statement.paidByUserId;

      if (
        dto.status === PayrollStatementStatus.ENVIADA &&
        statement.status === PayrollStatementStatus.PENDIENTE
      ) {
        sentAt = new Date();
        sentByUserId = userId;
      }

      if (
        dto.status === PayrollStatementStatus.PAGADA &&
        !paymentTransactionId
      ) {
        const paymentTransaction = await tx.financialTransaction.create({
          data: {
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PAYROLL,
            amount: statement.totalAmount,
            description: `Pago cuenta de cobro nomina #${statement.id}`,
            userId,
          },
        });

        paymentTransactionId = paymentTransaction.id;
        paidAt = new Date();
        paidByUserId = userId;

        await tx.payrollShift.updateMany({
          where: {
            billingStatementId: statement.id,
          },
          data: {
            status: PayrollShiftStatus.PAID,
            updatedByUserId: userId,
          },
        });
      }

      return tx.payrollBillingStatement.update({
        where: { id },
        data: {
          status: dto.status,
          paymentTransactionId,
          paidAt,
          paidByUserId,
          sentAt,
          sentByUserId,
          updatedByUserId: userId,
        },
      });
    });
  }

  private assertStatementStatusTransition(
    currentStatus: PayrollStatementStatus,
    nextStatus: PayrollStatementStatus,
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions: Record<
      PayrollStatementStatus,
      PayrollStatementStatus[]
    > = {
      [PayrollStatementStatus.PENDIENTE]: [PayrollStatementStatus.ENVIADA],
      [PayrollStatementStatus.ENVIADA]: [PayrollStatementStatus.PAGADA],
      [PayrollStatementStatus.PAGADA]: [],
    };

    const allowedNextStatuses = allowedTransitions[currentStatus] || [];
    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `Transicion de estado invalida: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  private async resolveShiftPayload(dto: CreatePayrollShiftDto) {
    this.validateShiftTimes(dto.startTime, dto.endTime, dto.breakMinutes ?? 0);

    if (dto.workerId) {
      const worker = await this.prisma.payrollWorker.findUnique({
        where: { id: dto.workerId },
      });

      if (!worker) {
        throw new NotFoundException('Trabajador no encontrado');
      }

      if (!worker.isActive) {
        throw new BadRequestException(
          'No se pueden registrar turnos para un trabajador inactivo',
        );
      }

      return {
        workerId: worker.id,
        collaborator: worker.displayName,
        hourlyRateApplied: decimalToNumber(worker.hourlyRate),
        totalAmount: this.calculateShiftAmount({
          startTime: dto.startTime,
          endTime: dto.endTime,
          breakMinutes: dto.breakMinutes ?? 0,
          hourlyRate: decimalToNumber(worker.hourlyRate),
        }),
      };
    }

    const collaborator = dto.collaborator?.trim();
    if (!collaborator) {
      throw new BadRequestException(
        'Debe enviar workerId o collaborator para registrar el turno',
      );
    }

    if (dto.totalAmount === undefined) {
      throw new BadRequestException(
        'El totalAmount es obligatorio cuando no existe workerId',
      );
    }

    return {
      workerId: null,
      collaborator,
      hourlyRateApplied: 0,
      totalAmount: dto.totalAmount,
    };
  }

  private async ensureShiftHasNoConflict(options: {
    workerId: number | null;
    workDate: string;
    startTime: string;
    endTime: string;
    ignoreShiftId?: number;
  }) {
    const { workerId, workDate, startTime, endTime, ignoreShiftId } = options;

    if (!workerId) {
      return;
    }

    const targetDate = new Date(workDate);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingShifts = await this.prisma.payrollShift.findMany({
      where: {
        workerId,
        workDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        ...(ignoreShiftId ? { id: { not: ignoreShiftId } } : {}),
        status: {
          not: PayrollShiftStatus.CANCELLED,
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    const nextStart = this.toMinutes(startTime);
    const nextEnd = this.toMinutes(endTime);
    const hasOverlap = existingShifts.some((shift) => {
      const currentStart = this.toMinutes(shift.startTime);
      const currentEnd = this.toMinutes(shift.endTime);

      return nextStart < currentEnd && currentStart < nextEnd;
    });

    if (hasOverlap) {
      throw new BadRequestException(
        'El trabajador ya tiene un turno registrado que se cruza con ese horario',
      );
    }
  }

  private validateShiftTimes(
    startTime: string,
    endTime: string,
    breakMinutes: number,
  ) {
    const start = this.toMinutes(startTime);
    const end = this.toMinutes(endTime);

    if (end <= start) {
      throw new BadRequestException(
        'La hora de salida debe ser mayor a la hora de entrada',
      );
    }

    if (breakMinutes < 0) {
      throw new BadRequestException(
        'El tiempo de descanso no puede ser negativo',
      );
    }

    if (breakMinutes >= end - start) {
      throw new BadRequestException(
        'El tiempo de descanso no puede ser mayor o igual al turno trabajado',
      );
    }
  }

  private calculateShiftAmount(options: {
    startTime: string;
    endTime: string;
    breakMinutes: number;
    hourlyRate: number;
  }) {
    const { startTime, endTime, breakMinutes, hourlyRate } = options;
    const workedMinutes =
      this.toMinutes(endTime) - this.toMinutes(startTime) - breakMinutes;

    return Math.round((workedMinutes / 60) * hourlyRate);
  }

  private toMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      throw new BadRequestException('Formato de hora invalido');
    }

    return hours * 60 + minutes;
  }

  private async uploadShiftPhoto(
    file: Express.Multer.File | undefined,
    photoKind: 'entry' | 'exit',
  ) {
    if (!file) {
      return null;
    }

    const normalizedName = file.originalname.replace(/\s+/g, '-');
    const path = `payroll/${photoKind}/${Date.now()}-${normalizedName}`;

    return this.storageService.uploadFile('product-assets', path, file);
  }
}
