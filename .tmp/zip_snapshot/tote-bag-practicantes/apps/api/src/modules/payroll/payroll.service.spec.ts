import { BadRequestException } from '@nestjs/common';
import {
  PayrollShiftStatus,
  PayrollStatementStatus,
} from '../../generated/client/client';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PayrollService } from './payroll.service';

describe('PayrollService', () => {
  let service: PayrollService;
  const payrollShiftUpdateMany = jest.fn();
  const financialTransactionCreate = jest.fn();

  const prisma = {
    payrollWorker: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    payrollShift: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: payrollShiftUpdateMany,
      update: jest.fn(),
      delete: jest.fn(),
    },
    payrollBillingStatement: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    financialTransaction: {
      create: financialTransactionCreate,
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const storageService = {
    uploadFile: jest.fn(),
  } as unknown as StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.payrollShift.findMany as jest.Mock).mockResolvedValue([]);
    service = new PayrollService(prisma, storageService);
    (prisma.$transaction as jest.Mock).mockImplementation(
      (
        callback: (client: {
          payrollBillingStatement: typeof prisma.payrollBillingStatement;
          payrollShift: typeof prisma.payrollShift;
          financialTransaction: typeof prisma.financialTransaction;
        }) => Promise<unknown>,
      ) =>
        callback({
          payrollBillingStatement: prisma.payrollBillingStatement,
          payrollShift: prisma.payrollShift,
          financialTransaction: prisma.financialTransaction,
        }),
    );
  });

  it('calcula el total del turno en servidor usando la tarifa del trabajador', async () => {
    (prisma.payrollWorker.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      displayName: 'Maria',
      isActive: true,
      hourlyRate: 20000,
    });
    (prisma.payrollShift.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve(data),
    );

    const result = await service.createShift(
      {
        workerId: 5,
        workDate: '2026-03-17',
        startTime: '08:00',
        endTime: '12:30',
        breakMinutes: 30,
        notes: 'Turno manana',
      },
      {},
      'admin-1',
    );

    expect(result.hourlyRateApplied).toBe(20000);
    expect(result.totalAmount).toBe(80000);
    expect(result.collaborator).toBe('Maria');
    expect(result.status).toBe(PayrollShiftStatus.RECORDED);
  });

  it('rechaza la creacion de turnos para trabajadores inactivos', async () => {
    (prisma.payrollWorker.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      displayName: 'Maria',
      isActive: false,
      hourlyRate: 20000,
    });

    await expect(
      service.createShift({
        workerId: 5,
        workDate: '2026-03-17',
        startTime: '08:00',
        endTime: '12:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza crear turnos que se traslapan con otro del mismo trabajador', async () => {
    (prisma.payrollWorker.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      displayName: 'Maria',
      isActive: true,
      hourlyRate: 20000,
    });
    (prisma.payrollShift.findMany as jest.Mock).mockResolvedValue([
      {
        id: 10,
        startTime: '08:00',
        endTime: '12:00',
      },
    ]);

    await expect(
      service.createShift({
        workerId: 5,
        workDate: '2026-03-17',
        startTime: '11:00',
        endTime: '13:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige workerId para consolidar cuentas', async () => {
    await expect(
      service.consolidateStatement({}, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza consolidar turnos sin trabajador persistido', async () => {
    (prisma.payrollShift.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        workerId: null,
        collaborator: 'Maria',
        totalAmount: 50000,
        workDate: new Date('2026-03-17'),
        worker: null,
      },
    ]);

    await expect(
      service.consolidateStatement({ workerId: 5, shiftIds: [1] }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza pagar una cuenta que sigue pendiente', async () => {
    (prisma.payrollBillingStatement.findUnique as jest.Mock).mockResolvedValue({
      id: 10,
      status: PayrollStatementStatus.PENDIENTE,
      paymentTransactionId: null,
      paidAt: null,
      sentAt: null,
      sentByUserId: null,
      paidByUserId: null,
      totalAmount: 100000,
      shifts: [],
    });

    await expect(
      service.updateStatementStatus(
        10,
        { status: PayrollStatementStatus.PAGADA },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza inactivar un trabajador con turnos abiertos', async () => {
    (prisma.payrollWorker.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      displayName: 'Maria',
      documentNumber: '123',
      workerType: 'CONTRACTOR',
      hourlyRate: 20000,
      notes: '',
      isActive: true,
    });
    (prisma.payrollShift.count as jest.Mock).mockResolvedValue(2);

    await expect(
      service.updateWorker(5, { isActive: false }, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca turnos como pagados y crea transaccion al pagar una cuenta enviada', async () => {
    (prisma.payrollBillingStatement.findUnique as jest.Mock).mockResolvedValue({
      id: 10,
      status: PayrollStatementStatus.ENVIADA,
      paymentTransactionId: null,
      paidAt: null,
      sentAt: new Date('2026-03-17'),
      sentByUserId: 'admin-1',
      paidByUserId: null,
      totalAmount: 100000,
      shifts: [{ id: 1 }],
    });
    (prisma.financialTransaction.create as jest.Mock).mockResolvedValue({
      id: 'trx-1',
    });
    (prisma.payrollBillingStatement.update as jest.Mock).mockImplementation(
      ({ data }) => Promise.resolve(data),
    );

    const result = await service.updateStatementStatus(
      10,
      { status: PayrollStatementStatus.PAGADA },
      'admin-2',
    );

    expect(financialTransactionCreate.mock.calls).toHaveLength(1);
    const [updateManyArgs] = payrollShiftUpdateMany.mock.calls as Array<
      [
        {
          where: { billingStatementId: number };
          data: {
            status: PayrollShiftStatus;
            updatedByUserId: string;
          };
        },
      ]
    >;

    expect(updateManyArgs?.[0]).toEqual({
      where: {
        billingStatementId: 10,
      },
      data: {
        status: PayrollShiftStatus.PAID,
        updatedByUserId: 'admin-2',
      },
    });
    expect(result.paymentTransactionId).toBe('trx-1');
    expect(result.paidByUserId).toBe('admin-2');
  });
});
