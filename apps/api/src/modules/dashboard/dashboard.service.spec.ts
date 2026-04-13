import Decimal from 'decimal.js';
import { DashboardService } from './dashboard.service';
import { TransactionType } from '../../generated/client/enums';

describe('DashboardService', () => {
  it('normalizes decimal dashboard money fields to numbers', async () => {
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        { _sum: { balance: new Decimal('1234.56') } },
        [
          { amount: new Decimal('500.25'), type: TransactionType.INCOME },
          { amount: new Decimal('100.10'), type: TransactionType.EXPENSE },
        ],
        [{ productId: 'top-product', _sum: { quantity: 12 } }],
        [{ productId: 'low-product', _sum: { quantity: 1 } }],
      ]),
      order: { count: jest.fn() },
      variant: { count: jest.fn() },
      b2BQuote: { count: jest.fn() },
      pqrsTicket: { count: jest.fn() },
      personalizationRequest: { count: jest.fn() },
      purchaseBatch: { count: jest.fn() },
      supplier: { aggregate: jest.fn() },
      financialTransaction: { findMany: jest.fn() },
      orderItem: { groupBy: jest.fn() },
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
    const service = new DashboardService(prisma as never);

    const stats = await service.getStats();

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
  });
});
