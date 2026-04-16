import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  PersonalizationRequestStatus,
  ShipmentStatus,
  TransactionType,
} from '../../generated/client/enums';
import { decimalToNumber } from '../../common/utils/sales-tax.util';

export interface ProductSalesBadge {
  productId: string;
  productName: string;
  unitsSold: number;
  imageUrl: string | null;
}

export interface DashboardStats {
  dailyProduction: number;
  lowStockCount: number;
  pendingQuotes: number;
  newPqrsCount: number;
  pendingPaymentOrders: number;
  inProductionOrders: number;
  pendingShipments: number;
  pendingPersonalizationRequests: number;
  inReviewPersonalizationRequests: number;
  approvedPersonalizationRequests: number;
  staleBatches: number;
  supplierPendingBalance: number;
  monthlyCashFlowNet: number;
  topSellingProduct: ProductSalesBadge | null;
  lowestSellingProduct: ProductSalesBadge | null;
}

interface DashboardStatsOptions {
  includeAdminMetrics?: boolean;
}

interface GroupedOrderItemSales {
  productId: string;
  _sum?: {
    quantity?: number | null;
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(
    lowStockThreshold = 10,
    options: DashboardStatsOptions = {},
  ): Promise<DashboardStats> {
    try {
      return await this.buildStats(lowStockThreshold, options);
    } catch (error) {
      console.error('Dashboard stats failed:', error);
      return this.getFallbackStats();
    }
  }

  private async buildStats(
    lowStockThreshold = 10,
    options: DashboardStatsOptions = {},
  ): Promise<DashboardStats> {
    const includeAdminMetrics = options.includeAdminMetrics !== false;
    const businessTimeZone = 'America/Bogota';
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: businessTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = Number(dateParts.find((p) => p.type === 'year')?.value);
    const month = Number(dateParts.find((p) => p.type === 'month')?.value);
    const day = Number(dateParts.find((p) => p.type === 'day')?.value);

    const startOfDay = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0, 0));
    const staleBatchCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const saleStatuses = [
      OrderStatus.PAGADA,
      OrderStatus.EN_PRODUCCION,
      OrderStatus.ENVIADA,
      OrderStatus.ENTREGADA,
    ];

    const [
      dailyProduction,
      lowStockCount,
      pendingQuotes,
      newPqrsCount,
      pendingPaymentOrders,
      inProductionOrders,
      pendingShipments,
      pendingPersonalizationRequests,
      inReviewPersonalizationRequests,
      approvedPersonalizationRequests,
      staleBatches,
      supplierPendingBalance,
      monthlyTransactions,
      topSellingProductRaw,
      lowestSellingProductRaw,
    ] = await Promise.all([
      this.safeStat('dailyProduction', () =>
        this.prisma.order.count({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        }),
      ),
      this.safeStat('lowStockCount', () =>
        this.prisma.variant.count({
          where: {
            stock: {
              lt: lowStockThreshold,
            },
            product: {
              isActive: true,
            },
          },
        }),
      ),
      this.safeStat('pendingQuotes', () =>
        this.prisma.b2BQuote.count({
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
        }),
      ),
      this.safeStat('newPqrsCount', () =>
        this.prisma.pqrsTicket.count({
          where: {
            status: 'NUEVO',
          },
        }),
      ),
      this.safeStat('pendingPaymentOrders', () =>
        this.prisma.order.count({
          where: {
            status: OrderStatus.PENDIENTE_PAGO,
          },
        }),
      ),
      this.safeStat('inProductionOrders', () =>
        this.prisma.order.count({
          where: {
            status: OrderStatus.EN_PRODUCCION,
          },
        }),
      ),
      this.safeStat('pendingShipments', () =>
        this.prisma.order.count({
          where: {
            status: OrderStatus.PAGADA,
            OR: [
              { shipment: { is: null } },
              {
                shipment: {
                  is: {
                    status: {
                      in: [
                        ShipmentStatus.PENDING,
                        ShipmentStatus.READY_TO_SHIP,
                      ],
                    },
                  },
                },
              },
            ],
          },
        }),
      ),
      this.safeStat('pendingPersonalizationRequests', () =>
        this.prisma.personalizationRequest.count({
          where: {
            status: PersonalizationRequestStatus.PENDING,
          },
        }),
      ),
      this.safeStat('inReviewPersonalizationRequests', () =>
        this.prisma.personalizationRequest.count({
          where: {
            status: PersonalizationRequestStatus.IN_REVIEW,
          },
        }),
      ),
      this.safeStat('approvedPersonalizationRequests', () =>
        this.prisma.personalizationRequest.count({
          where: {
            status: PersonalizationRequestStatus.APPROVED,
          },
        }),
      ),
      includeAdminMetrics
        ? this.safeStat('staleBatches', () =>
            this.prisma.purchaseBatch.count({
              where: {
                status: 'IN_STOCK',
                quantityRemaining: { gt: 0 },
                createdAt: {
                  lt: staleBatchCutoff,
                },
              },
            }),
          )
        : Promise.resolve(0),
      includeAdminMetrics
        ? this.safeStat('supplierPendingBalance', async () => {
            const aggregate = await this.prisma.supplier.aggregate({
              _sum: {
                balance: true,
              },
              where: {
                balance: {
                  gt: 0,
                },
              },
            });

            return decimalToNumber(aggregate._sum.balance);
          })
        : Promise.resolve(0),
      includeAdminMetrics
        ? this.safeStat(
            'monthlyTransactions',
            () =>
              this.prisma.financialTransaction.findMany({
                where: {
                  createdAt: {
                    gte: startOfMonth,
                    lte: endOfDay,
                  },
                },
                select: {
                  amount: true,
                  type: true,
                },
              }),
            [],
          )
        : Promise.resolve([]),
      this.safeStat(
        'topSellingProduct',
        () =>
          this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
              order: {
                status: {
                  in: saleStatuses,
                },
              },
            },
            _sum: {
              quantity: true,
            },
            orderBy: [
              {
                _sum: {
                  quantity: 'desc',
                },
              },
              {
                productId: 'asc',
              },
            ],
            take: 1,
          }),
        [],
      ),
      this.safeStat(
        'lowestSellingProduct',
        () =>
          this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
              order: {
                status: {
                  in: saleStatuses,
                },
              },
            },
            _sum: {
              quantity: true,
            },
            orderBy: [
              {
                _sum: {
                  quantity: 'asc',
                },
              },
              {
                productId: 'asc',
              },
            ],
            take: 1,
          }),
        [],
      ),
    ]);

    const monthlyCashFlowNet = monthlyTransactions.reduce(
      (sum, transaction) => {
        const amount = decimalToNumber(transaction.amount);
        return transaction.type === TransactionType.INCOME
          ? sum + amount
          : sum - amount;
      },
      0,
    );

    const badgeProductIds = [
      topSellingProductRaw[0]?.productId,
      lowestSellingProductRaw[0]?.productId,
    ].filter((value): value is string => Boolean(value));

    const badgeProducts = badgeProductIds.length
      ? await this.safeStat(
          'badgeProducts',
          () =>
            this.prisma.product.findMany({
              where: {
                id: {
                  in: badgeProductIds,
                },
              },
              select: {
                id: true,
                name: true,
                images: {
                  select: {
                    url: true,
                  },
                  orderBy: {
                    position: 'asc',
                  },
                  take: 1,
                },
              },
            }),
          [],
        )
      : [];

    const productNameById = new Map(
      badgeProducts.map((product) => [product.id, product.name]),
    );
    const productImageById = new Map(
      badgeProducts.map((product) => [
        product.id,
        Array.isArray(product.images) ? product.images[0]?.url || null : null,
      ]),
    );

    return {
      dailyProduction,
      lowStockCount,
      pendingQuotes,
      newPqrsCount,
      pendingPaymentOrders,
      inProductionOrders,
      pendingShipments,
      pendingPersonalizationRequests,
      inReviewPersonalizationRequests,
      approvedPersonalizationRequests,
      staleBatches,
      supplierPendingBalance,
      monthlyCashFlowNet,
      topSellingProduct: this.toProductSalesBadge(
        topSellingProductRaw[0],
        productNameById,
        productImageById,
      ),
      lowestSellingProduct: this.toProductSalesBadge(
        lowestSellingProductRaw[0],
        productNameById,
        productImageById,
      ),
    };
  }

  private getFallbackStats(): DashboardStats {
    return {
      dailyProduction: 0,
      lowStockCount: 0,
      pendingQuotes: 0,
      newPqrsCount: 0,
      pendingPaymentOrders: 0,
      inProductionOrders: 0,
      pendingShipments: 0,
      pendingPersonalizationRequests: 0,
      inReviewPersonalizationRequests: 0,
      approvedPersonalizationRequests: 0,
      staleBatches: 0,
      supplierPendingBalance: 0,
      monthlyCashFlowNet: 0,
      topSellingProduct: null,
      lowestSellingProduct: null,
    };
  }

  private async safeStat<T>(
    label: string,
    getValue: () => Promise<T>,
    fallback: T,
  ): Promise<T>;
  private async safeStat(
    label: string,
    getValue: () => Promise<number>,
  ): Promise<number>;
  private async safeStat<T>(
    label: string,
    getValue: () => Promise<T>,
    fallback?: T,
  ) {
    try {
      return await getValue();
    } catch (error) {
      console.error(`Dashboard stats metric failed: ${label}`, error);
      return fallback ?? 0;
    }
  }

  private toProductSalesBadge(
    grouped: GroupedOrderItemSales | undefined,
    productNameById: Map<string, string>,
    productImageById: Map<string, string | null>,
  ): ProductSalesBadge | null {
    if (!grouped) {
      return null;
    }

    return {
      productId: grouped.productId,
      productName:
        productNameById.get(grouped.productId) || 'Producto sin nombre',
      unitsSold: grouped._sum?.quantity || 0,
      imageUrl: productImageById.get(grouped.productId) || null,
    };
  }
}
