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

  it('returns an empty summary when financial transaction storage is missing', async () => {
    const missingTableError = new Prisma.PrismaClientKnownRequestError(
      'financial_transactions table missing',
      {
        code: 'P2021',
        clientVersion: 'test',
      },
    );
    const service = new FinanceService({
      financialTransaction: {
        aggregate: jest.fn().mockRejectedValue(missingTableError),
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
    } as never);

    await expect(service.getFinancialSummaryLocalized()).resolves.toEqual({
      kpis: {
        totalIncome: 0,
        totalOpex: 0,
        totalPurchases: 0,
        totalCOGS: null,
      },
      cashFlowChart: [],
      recentTransactions: [],
    });
  });

  it('returns empty cash flow data when financial transaction storage is missing', async () => {
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      'financial_transactions supplier_id column missing',
      {
        code: 'P2022',
        clientVersion: 'test',
      },
    );
    const service = new FinanceService({
      financialTransaction: {
        findMany: jest.fn().mockRejectedValue(missingColumnError),
      },
    } as never);

    await expect(service.getCashFlowData('monthly')).resolves.toEqual([]);
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

  it('builds per-order profitability including VAT reserve, retentions as asset, and gateway-net margin alert', async () => {
    const service = new FinanceService({
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: 101,
            customerEmail: 'cliente@tote.co',
            createdAt: new Date('2026-03-10T10:00:00.000Z'),
            status: 'ENTREGADA',
            totalAmount: 119000,
            netAmount: 100000,
            taxTotal: 19000,
            amountPaid: 119000,
            balanceDue: 0,
            items: [
              {
                id: 'item-1',
                sku: 'TB-001',
                quantity: 2,
                pricingJson: {
                  inventoryConsumption: {
                    totalCOGS: 40000,
                    reductions: [
                      {
                        batchId: 'batch-1',
                        supplierId: 'supplier-1',
                        quantity: 2,
                        unitCost: 20000,
                        documentType: 'INVOICE',
                      },
                    ],
                  },
                },
                variant: { costPrice: 18000, totalCost: 20000, taxRate: 0.19 },
              },
            ],
            payments: [
              {
                id: 'payment-1',
                amount: 119000,
                paymentDate: new Date('2026-03-10T10:00:00.000Z'),
                provider: 'wompi',
                paymentMethodType: 'CARD',
                grossAmount: 119000,
                netReceivedAmount: 111440,
                commissionAmount: 3000,
                commissionVatAmount: 570,
                reteFuenteAmount: 1500,
                reteIvaAmount: 1000,
                reteIcaAmount: 500,
                packagingCifAmount: 990,
                settlementSource: 'WOMPI_REPORT',
              },
            ],
          },
        ]),
      },
    } as never);

    const result = await service.getOrderProfitabilityReport({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result.summary).toMatchObject({
      orderCount: 1,
      vatLiability: 19000,
      retentionAssetTotal: 3000,
      grossProfit: 60000,
      operatingProfit: 55440,
      netProfit: 55440,
      realNetProfit: 55440,
      netReceivedBank: 111440,
      belowTargetCount: 1,
    });
    expect(result.orders[0]).toMatchObject({
      orderNumber: 101,
      ingresoBruto: 119000,
      ventaNetaSinIva: 100000,
      iva: 19000,
      costoProducto: 40000,
      utilidadNetaReal: 55440,
      netoRecibidoBanco: 111440,
      retencionesActivas: 3000,
      alertaMargenBajo: true,
    });
    expect(result.orders[0].margenSobreNetoPasarela).toBeCloseTo(0.497487, 6);
  });

  it('uses a custom simulator margin target for the gateway grid', () => {
    const service = new FinanceService({} as never);

    const result = service.getGatewayMarginGrid({
      grossAmount: 119000,
      productCost: 40000,
      taxRate: 0.19,
      marginTarget: 40,
    });

    expect(result.current.alertaMargenBajo).toBe(false);
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]).toMatchObject({
      targetMargin: 0.4,
      reachable: true,
    });
  });

  it('aggregates monthly retentions as tax asset advances', async () => {
    const service = new FinanceService({
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: 101,
            customerEmail: 'cliente@tote.co',
            createdAt: new Date('2026-03-10T10:00:00.000Z'),
            status: 'ENTREGADA',
            totalAmount: 119000,
            netAmount: 100000,
            taxTotal: 19000,
            amountPaid: 119000,
            balanceDue: 0,
            items: [
              {
                id: 'item-1',
                sku: 'TB-001',
                quantity: 1,
                pricingJson: {
                  inventoryConsumption: {
                    totalCOGS: 30000,
                    reductions: [
                      {
                        batchId: 'batch-1',
                        supplierId: 'supplier-1',
                        quantity: 1,
                        unitCost: 30000,
                        documentType: 'INVOICE',
                      },
                    ],
                  },
                },
                variant: { costPrice: 30000, totalCost: 30000, taxRate: 0.19 },
              },
            ],
            payments: [
              {
                id: 'payment-1',
                amount: 119000,
                paymentDate: new Date('2026-03-10T10:00:00.000Z'),
                provider: 'wompi',
                paymentMethodType: 'CARD',
                grossAmount: 119000,
                netReceivedAmount: 112000,
                commissionAmount: 2500,
                commissionVatAmount: 475,
                reteFuenteAmount: 900,
                reteIvaAmount: 600,
                reteIcaAmount: 200,
                packagingCifAmount: 990,
                settlementSource: 'WOMPI_REPORT',
              },
            ],
          },
          {
            id: 'order-2',
            orderNumber: 202,
            customerEmail: 'abril@tote.co',
            createdAt: new Date('2026-04-03T10:00:00.000Z'),
            status: 'ENTREGADA',
            totalAmount: 238000,
            netAmount: 200000,
            taxTotal: 38000,
            amountPaid: 238000,
            balanceDue: 0,
            items: [
              {
                id: 'item-2',
                sku: 'TB-002',
                quantity: 1,
                pricingJson: {
                  inventoryConsumption: {
                    totalCOGS: 80000,
                    reductions: [
                      {
                        batchId: 'batch-2',
                        supplierId: 'supplier-2',
                        quantity: 1,
                        unitCost: 80000,
                        documentType: 'INVOICE',
                      },
                    ],
                  },
                },
                variant: { costPrice: 80000, totalCost: 80000, taxRate: 0.19 },
              },
            ],
            payments: [
              {
                id: 'payment-2',
                amount: 238000,
                paymentDate: new Date('2026-04-03T10:00:00.000Z'),
                provider: 'wompi',
                paymentMethodType: 'CARD',
                grossAmount: 238000,
                netReceivedAmount: 225000,
                commissionAmount: 4000,
                commissionVatAmount: 760,
                reteFuenteAmount: 1800,
                reteIvaAmount: 1200,
                reteIcaAmount: 400,
                packagingCifAmount: 990,
                settlementSource: 'WOMPI_REPORT',
              },
            ],
          },
        ]),
      },
    } as never);

    const result = await service.getRetentionReport({
      startDate: '2026-03-01',
      endDate: '2026-04-30',
    });

    expect(result.summary).toEqual({
      orderCount: 2,
      reteFuenteTotal: 2700,
      reteIvaTotal: 1800,
      reteIcaTotal: 600,
      retentionAssetTotal: 5100,
    });
    expect(result.months).toEqual([
      {
        month: '2026-03',
        orderCount: 1,
        reteFuente: 900,
        reteIva: 600,
        reteIca: 200,
        total: 1700,
      },
      {
        month: '2026-04',
        orderCount: 1,
        reteFuente: 1800,
        reteIva: 1200,
        reteIca: 400,
        total: 3400,
      },
    ]);
  });

  it('creates a safe default monthly fixed-expense config when none exists', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const executeRaw = jest.fn().mockResolvedValue(1);
    const service = new FinanceService({
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
    } as never);

    const result = await service.getFixedExpensesConfig();

    expect(queryRaw).toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalled();
    expect(result).toMatchObject({
      key: 'finance.monthly_fixed_expenses',
      currency: 'COP',
      period: 'monthly',
      monthlyTotal: 0,
      isConfigured: false,
    });
    expect(result.items).toEqual([
      { id: 'payroll', label: 'Nomina', amount: 0 },
      { id: 'rent', label: 'Arriendo', amount: 0 },
      { id: 'services', label: 'Servicios', amount: 0 },
    ]);
  });

  it('persists monthly fixed-expense config totals for the administrator', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const service = new FinanceService({
      $executeRaw: executeRaw,
    } as never);

    const result = await service.updateFixedExpensesConfig({
      items: [
        { id: 'payroll', label: 'Nomina', amount: '2500000' },
        { id: 'rent', label: 'Arriendo', amount: '1800000' },
        { id: 'services', label: 'Servicios', amount: '450000' },
      ],
    });

    expect(executeRaw).toHaveBeenCalled();
    expect(result).toMatchObject({
      monthlyTotal: 4750000,
      isConfigured: true,
      items: [
        { id: 'payroll', label: 'Nomina', amount: 2500000 },
        { id: 'rent', label: 'Arriendo', amount: 1800000 },
        { id: 'services', label: 'Servicios', amount: 450000 },
      ],
    });
  });

  it('builds a break-even thermometer from accumulated real net profit versus monthly fixed expenses', async () => {
    const service = new FinanceService({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          value: {
            currency: 'COP',
            period: 'monthly',
            items: [
              { id: 'payroll', label: 'Nomina', amount: 5000000 },
              { id: 'rent', label: 'Arriendo', amount: 3000000 },
            ],
          },
          updated_at: new Date('2026-03-01T10:00:00.000Z'),
        },
      ]),
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: 101,
            customerEmail: 'cliente@tote.co',
            createdAt: new Date('2026-03-10T10:00:00.000Z'),
            status: 'ENTREGADA',
            totalAmount: 7000000,
            netAmount: 6000000,
            taxTotal: 1000000,
            amountPaid: 7000000,
            balanceDue: 0,
            items: [
              {
                id: 'item-1',
                sku: 'TB-001',
                quantity: 1,
                pricingJson: null,
                variant: {
                  costPrice: 2000000,
                  totalCost: 2000000,
                  taxRate: 0.19,
                },
              },
            ],
            payments: [
              {
                id: 'payment-1',
                amount: 7000000,
                paymentDate: new Date('2026-03-10T10:00:00.000Z'),
                provider: 'manual',
                paymentMethodType: 'TRANSFER',
                grossAmount: 7000000,
                netReceivedAmount: 7000000,
                commissionAmount: 0,
                commissionVatAmount: 0,
                reteFuenteAmount: 0,
                reteIvaAmount: 0,
                reteIcaAmount: 0,
                packagingCifAmount: 0,
                settlementSource: 'MANUAL',
              },
            ],
          },
        ]),
      },
    } as never);

    const result = await service.getBreakEvenThermometer({
      month: '03',
      year: '2026',
    });

    expect(result).toMatchObject({
      orderCount: 1,
      accumulatedNetProfit: 4000000,
      targetFixedExpenses: 8000000,
      progressRatio: 0.5,
      progressPercentage: 50,
      progressPercentageCapped: 50,
      remainingToBreakEven: 4000000,
      surplusOverBreakEven: 0,
      status: 'IN_PROGRESS',
    });
    expect(result.fixedExpensesConfig).toMatchObject({
      monthlyTotal: 8000000,
      isConfigured: true,
    });
  });
});
