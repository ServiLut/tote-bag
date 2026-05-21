import { BadRequestException } from '@nestjs/common';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  const inventoryService = {
    getDetailedInventory: jest.fn(),
    getInventoryMovements: jest.fn(),
    getReorderAlerts: jest.fn(),
    listNonCommercialOutputs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    inventoryService.getDetailedInventory.mockResolvedValue([]);
    inventoryService.getInventoryMovements.mockResolvedValue([]);
    inventoryService.getReorderAlerts.mockResolvedValue({
      count: 0,
      variants: [],
      supplies: [],
    });
    inventoryService.listNonCommercialOutputs.mockResolvedValue([]);
  });

  it('rechaza rangos invertidos antes de consultar Prisma', async () => {
    const prisma = {
      financialTransaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      purchaseBatch: {
        findMany: jest.fn(),
      },
    };
    const service = new ReportingService(
      prisma as never,
      inventoryService as never,
    );

    await expect(
      service.getAccountingReport(
        new Date('2026-03-31T00:00:00.000Z'),
        new Date('2026-03-01T23:59:59.999Z'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.financialTransaction.aggregate).not.toHaveBeenCalled();
  });

  it('rechaza fechas invalidas antes de consultar Prisma', async () => {
    const prisma = {
      financialTransaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      purchaseBatch: {
        findMany: jest.fn(),
      },
    };
    const service = new ReportingService(
      prisma as never,
      inventoryService as never,
    );

    await expect(
      service.getClosingReport(
        new Date('invalid'),
        new Date('2026-03-31'),
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.financialTransaction.aggregate).not.toHaveBeenCalled();
  });

  it('genera un XLSX sin depender de paquetes externos vulnerables', async () => {
    const prisma = {
      financialTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      purchaseBatch: {
        findMany: jest.fn(),
      },
    };
    const service = new ReportingService(
      prisma as never,
      inventoryService as never,
    );

    const buffer = await service.generateAccountingExcel(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    );

    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('no registra auditoria al consultar el cierre contable', async () => {
    const prisma = {
      financialTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      purchaseBatch: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new ReportingService(
      prisma as never,
      inventoryService as never,
    );

    await service.getClosingReport(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
      'admin-1',
    );

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('genera un XLSX para inventario FIFO', async () => {
    const prisma = {};
    const service = new ReportingService(
      prisma as never,
      inventoryService as never,
    );

    const buffer = await service.generateFifoInventoryExcel();

    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(inventoryService.getDetailedInventory).toHaveBeenCalled();
    expect(inventoryService.getInventoryMovements).toHaveBeenCalled();
    expect(inventoryService.getReorderAlerts).toHaveBeenCalled();
  });

  it('genera un PDF para salidas no comerciales', async () => {
    const prisma = {};
    inventoryService.listNonCommercialOutputs.mockResolvedValue([
      {
        id: 'out-1',
        quantity: 2,
        reason: 'GIFT',
        status: 'COMPLETED',
        createdAt: '2026-05-19T10:00:00.000Z',
        notes: 'Entrega interna',
        variant: {
          id: 'variant-1',
          sku: 'SKU-001',
          size: 'M',
          color: 'Negro',
          product: {
            id: 'product-1',
            name: 'Bolso clasico',
            slug: 'bolso-clasico',
          },
        },
        user: {
          id: 'user-1',
          email: 'admin@totebag.co',
          profile: {
            firstName: 'Ana',
            lastName: 'Admin',
          },
        },
      },
    ]);
    const service = new ReportingService(
      prisma as never,
      inventoryService as never,
    );

    const buffer = await service.generateNonCommercialOutputsPDF();

    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(inventoryService.listNonCommercialOutputs).toHaveBeenCalled();
  });
});
