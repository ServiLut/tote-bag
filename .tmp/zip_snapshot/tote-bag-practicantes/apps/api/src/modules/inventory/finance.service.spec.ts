import { FinanceService } from './finance.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import {
  TransactionCategory,
  TransactionType,
} from '../../generated/client/enums';

describe('FinanceService PDF rendering', () => {
  it('normalizes supplier payloads before creating them', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'supplier-1' });
    const service = new FinanceService({
      supplier: {
        create,
      },
    } as never);

    await service.createSupplier({
      name: '  Proveedor Uno  ',
      nit: ' 900123456-7 ',
      contact: '  Ana  ',
      phone: ' 3001234567 ',
      email: '  compras@proveedor.co  ',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Proveedor Uno',
        nit: '900123456-7',
        contact: 'Ana',
        phone: '3001234567',
        email: 'compras@proveedor.co',
      },
    });
  });

  it('raises a conflict when creating a supplier with duplicate nit', async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate nit', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['nit'] },
      }),
    );
    const service = new FinanceService({
      supplier: {
        create,
      },
    } as never);

    await expect(
      service.createSupplier({
        name: 'Proveedor Uno',
        nit: '900123456-7',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('renders a PDF even when historical order fields are incomplete', async () => {
    const service = new FinanceService({} as never);

    const buffer = await (
      service as unknown as {
        renderFinancialReportPdf: (
          label: string,
          startDate: Date,
          endDate: Date,
          metrics: {
            paidOrders: Array<{
              orderNumber: number;
              customerEmail: string | null;
              totalAmount: number;
              createdAt: Date;
              items: Array<{ quantity: number }>;
              statusHistory: Array<{ status: string; createdAt: Date }>;
              shipment: { status: string | null } | null;
            }>;
            returnedOrders: Array<{
              orderNumber: number;
              totalAmount: number;
              createdAt: Date;
              statusHistory: Array<{ status: string; createdAt: Date }>;
              shipment: { status: string | null } | null;
            }>;
            summary: {
              orderCount: number;
              returnedOrderCount: number;
              totalItems: number;
              returnItems: number;
              grossSales: number;
              returnsTotal: number;
              subtotal: number;
              estimatedTaxes: number;
              netBalance: number;
            };
          },
        ) => Promise<Buffer>;
      }
    ).renderFinancialReportPdf(
      'Marzo 2026',
      new Date('2026-03-01'),
      new Date('2026-03-31'),
      {
        paidOrders: [
          {
            orderNumber: 101,
            customerEmail: null,
            totalAmount: 250000,
            createdAt: new Date('2026-03-10'),
            items: [{ quantity: 2 }],
            statusHistory: [
              { status: 'PAGADA', createdAt: new Date('2026-03-10') },
            ],
            shipment: null,
          },
        ],
        returnedOrders: [
          {
            orderNumber: 202,
            totalAmount: 50000,
            createdAt: new Date('2026-03-12'),
            statusHistory: [
              {
                status: 'RETURNED_TO_STOCK',
                createdAt: new Date('2026-03-12'),
              },
            ],
            shipment: { status: null },
          },
        ],
        summary: {
          orderCount: 1,
          returnedOrderCount: 1,
          totalItems: 2,
          returnItems: 1,
          grossSales: 250000,
          returnsTotal: 50000,
          subtotal: 168067,
          estimatedTaxes: 31933,
          netBalance: 200000,
        },
      },
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('returns a summary even if audit log lookup fails', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: 150000 } })
      .mockResolvedValueOnce({ _sum: { amount: 20000 } })
      .mockResolvedValueOnce({ _sum: { amount: 50000 } });
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          type: TransactionType.INCOME,
          amount: 150000,
          createdAt: new Date('2026-03-02T10:00:00.000Z'),
        },
        {
          type: TransactionType.EXPENSE,
          amount: 20000,
          createdAt: new Date('2026-03-03T10:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'tx-1',
          type: TransactionType.INCOME,
          category: TransactionCategory.SALE,
          amount: 150000,
          description: 'Venta',
          status: 'COMPLETED',
          createdAt: new Date('2026-03-02T10:00:00.000Z'),
        },
      ]);

    const service = new FinanceService({
      financialTransaction: {
        aggregate,
        findMany,
      },
      auditLog: {
        findMany: jest.fn().mockRejectedValue(new Error('db error')),
      },
    } as never);

    const result = await service.getFinancialSummaryLocalized(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    );

    expect(result.kpis).toEqual({
      totalIncome: 150000,
      totalOpex: 20000,
      totalPurchases: 50000,
      totalCOGS: null,
    });
    expect(result.cashFlowChart).toEqual([
      { month: '2026-03', income: 150000, expense: 20000 },
    ]);
    expect(result.recentTransactions).toHaveLength(1);
  });

  it('groups summary chart by America/Bogota local month instead of UTC month', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: 100000 } })
      .mockResolvedValueOnce({ _sum: { amount: 20000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          type: TransactionType.INCOME,
          amount: 100000,
          createdAt: new Date('2026-03-01T04:30:00.000Z'),
        },
        {
          type: TransactionType.EXPENSE,
          amount: 20000,
          createdAt: new Date('2026-03-15T15:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    const service = new FinanceService({
      financialTransaction: {
        aggregate,
        findMany,
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as never);

    const result = await service.getFinancialSummaryLocalized(
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    );

    expect(result.cashFlowChart).toEqual([
      { month: '2026-02', income: 100000, expense: 0 },
      { month: '2026-03', income: 0, expense: 20000 },
    ]);
  });

  it('rejects inverted date ranges before querying Prisma', async () => {
    const service = new FinanceService({
      financialTransaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
    } as never);

    await expect(
      service.getFinancialSummary(
        new Date('2026-03-31T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('groups cash flow by America/Bogota local day instead of UTC day', async () => {
    const service = new FinanceService({
      financialTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            type: TransactionType.INCOME,
            amount: 100000,
            createdAt: new Date('2026-03-02T04:30:00.000Z'),
          },
          {
            type: TransactionType.EXPENSE,
            amount: 25000,
            createdAt: new Date('2026-03-02T15:00:00.000Z'),
          },
        ]),
      },
    } as never);

    const result = await service.getCashFlowData('daily');

    expect(result).toEqual([
      {
        label: '2026-03-01',
        income: 100000,
        expense: 0,
        net: 100000,
        balance: 100000,
      },
      {
        label: '2026-03-02',
        income: 0,
        expense: 25000,
        net: -25000,
        balance: 75000,
      },
    ]);
  });

  it('creates payroll opex entries when category name is Nomina with accents or mojibake variants', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'tx-1' });
    const basePrisma = {
      financialTransaction: {
        create,
      },
      opexCategory: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'cat-1', name: 'Nómina' }),
      },
    };

    const service = new FinanceService(basePrisma as never);

    await service.createOpexSafe({
      amount: 50000,
      description: 'Pago',
      opexCategoryId: 'cat-1',
      userId: 'user-1',
    });

    expect(create).toHaveBeenCalled();
    const [createArgs] = create.mock.calls[0] as [
      { data: { category: TransactionCategory } },
    ];
    expect(createArgs.data.category).toBe(TransactionCategory.PAYROLL);
  });

  it('rejects opex creation when the category does not exist', async () => {
    const service = new FinanceService({
      financialTransaction: {
        create: jest.fn(),
      },
      opexCategory: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as never);

    await expect(
      service.createOpexSafe({
        amount: 50000,
        description: 'Pago',
        opexCategoryId: 'cat-missing',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
