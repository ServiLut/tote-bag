import Decimal from 'decimal.js';
import { DashboardService } from './dashboard.service';
import { TransactionType } from '../../generated/client/enums';

function createPrismaMock() {
  return {
    order: {
      count: jest
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(7),
    },
    variant: { count: jest.fn().mockResolvedValue(2) },
    b2BQuote: { count: jest.fn().mockResolvedValue(3) },
    pqrsTicket: { count: jest.fn().mockResolvedValue(4) },
    personalizationRequest: {
      count: jest
        .fn()
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(9)
        .mockResolvedValueOnce(10),
    },
    purchaseBatch: { count: jest.fn().mockResolvedValue(11) },
    supplier: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { balance: new Decimal('1234.56') },
      }),
    },
    financialTransaction: {
      findMany: jest.fn().mockResolvedValue([
        { amount: new Decimal('500.25'), type: TransactionType.INCOME },
        { amount: new Decimal('100.10'), type: TransactionType.EXPENSE },
      ]),
    },
    orderItem: {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([
          { productId: 'top-product', _sum: { quantity: 12 } },
        ])
        .mockResolvedValueOnce([
          { productId: 'low-product', _sum: { quantity: 1 } },
        ]),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'top-product',
          name: 'Top Product',
          images: [{ url: 'https://example.com/top.jpg' }],
        },
        {
          id: 'low-product',
          name: 'Low Product',
          images: [],
        },
      ]),
    },
  };
}

describe('DashboardService', () => {
  it('normalizes decimal dashboard money fields to numbers', async () => {
    const prisma = createPrismaMock();
    const service = new DashboardService(prisma as never);

    const stats = await service.getStats();

    expect(stats.dailyProduction).toBe(1);
    expect(stats.lowStockCount).toBe(2);
    expect(stats.pendingQuotes).toBe(3);
    expect(stats.newPqrsCount).toBe(4);
    expect(stats.pendingPaymentOrders).toBe(5);
    expect(stats.inProductionOrders).toBe(6);
    expect(stats.pendingShipments).toBe(7);
    expect(stats.pendingPersonalizationRequests).toBe(8);
    expect(stats.inReviewPersonalizationRequests).toBe(9);
    expect(stats.approvedPersonalizationRequests).toBe(10);
    expect(stats.staleBatches).toBe(11);
    expect(stats.supplierPendingBalance).toBe(1234.56);
    expect(stats.monthlyCashFlowNet).toBe(400.15);
    expect(stats.topSellingProduct).toEqual({
      productId: 'top-product',
      productName: 'Top Product',
      unitsSold: 12,
      imageUrl: 'https://example.com/top.jpg',
    });
    expect(stats.lowestSellingProduct).toEqual({
      productId: 'low-product',
      productName: 'Low Product',
      unitsSold: 1,
      imageUrl: null,
    });
    expect(prisma.b2BQuote.count).toHaveBeenCalledWith({
      where: {
        status: {
          notIn: [
            'DISE\u00d1O_APROBADO',
            'DISENO_APROBADO',
            'DISEÃ‘O_APROBADO',
            'DISEÃƒâ€˜O_APROBADO',
            'DISEÃƒÆ’Ã¢â‚¬ËœO_APROBADO',
          ],
        },
      },
    });
  });

  it('returns fallback metrics instead of failing the dashboard endpoint', async () => {
    const prisma = createPrismaMock();
    prisma.purchaseBatch.count.mockRejectedValueOnce(
      new Error('missing optional inventory column'),
    );
    prisma.financialTransaction.findMany.mockRejectedValueOnce(
      new Error('missing optional finance table'),
    );
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const service = new DashboardService(prisma as never);

    const stats = await service.getStats();

    expect(stats.staleBatches).toBe(0);
    expect(stats.monthlyCashFlowNet).toBe(0);
    expect(stats.dailyProduction).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Dashboard stats metric failed: staleBatches',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('omits admin-only money and inventory metrics for non-admin dashboard stats', async () => {
    const prisma = createPrismaMock();
    const service = new DashboardService(prisma as never);

    const stats = await service.getStats(10, { includeAdminMetrics: false });

    expect(stats.staleBatches).toBe(0);
    expect(stats.supplierPendingBalance).toBe(0);
    expect(stats.monthlyCashFlowNet).toBe(0);
    expect(stats.pendingPaymentOrders).toBe(5);
    expect(prisma.purchaseBatch.count).not.toHaveBeenCalled();
    expect(prisma.supplier.aggregate).not.toHaveBeenCalled();
    expect(prisma.financialTransaction.findMany).not.toHaveBeenCalled();
  });

  it('returns a full fallback if dashboard response assembly fails', async () => {
    const prisma = createPrismaMock();
    prisma.financialTransaction.findMany.mockResolvedValueOnce([
      {
        amount: {
          toString: () => {
            throw new Error('invalid decimal payload');
          },
        },
        type: TransactionType.INCOME,
      },
    ] as never);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const service = new DashboardService(prisma as never);

    const stats = await service.getStats();

    expect(stats).toMatchObject({
      dailyProduction: 0,
      lowStockCount: 0,
      pendingQuotes: 0,
      monthlyCashFlowNet: 0,
      topSellingProduct: null,
      lowestSellingProduct: null,
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Dashboard stats failed:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
