import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  PersonalizationRequestStatus,
  ShipmentStatus,
  TransactionType,
} from '../../generated/client/enums';

export interface ProductSalesBadge {
  productId: string;
  productName: string;
  unitsSold: number;
  imageUrl: string | null;
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

  async getStats(lowStockThreshold = 10) {
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
      supplierBalanceAggregate,
      monthlyTransactions,
      topSellingProductRaw,
      lowestSellingProductRaw,
    ] = await this.prisma.$transaction([
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
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
      this.prisma.b2BQuote.count({
        where: {
          status: {
            notIn: [
              'DISEÑO_APROBADO',
              'DISEÑO_APROBADO',
              'DISEÃ‘O_APROBADO',
              'DISEÃƒâ€˜O_APROBADO',
            ],
          },
        },
      }),
      this.prisma.pqrsTicket.count({
        where: {
          status: 'NUEVO',
        },
      }),
      this.prisma.order.count({
        where: {
          status: 'PENDIENTE_PAGO',
        },
      }),
      this.prisma.order.count({
        where: {
          status: 'EN_PRODUCCION',
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.PAGADA,
          OR: [
            { shipment: null },
            {
              shipment: {
                status: {
                  in: [ShipmentStatus.PENDING, ShipmentStatus.READY_TO_SHIP],
                },
              },
            },
          ],
        },
      }),
      this.prisma.personalizationRequest.count({
        where: {
          status: PersonalizationRequestStatus.PENDING,
        },
      }),
      this.prisma.personalizationRequest.count({
        where: {
          status: PersonalizationRequestStatus.IN_REVIEW,
        },
      }),
      this.prisma.personalizationRequest.count({
        where: {
          status: PersonalizationRequestStatus.APPROVED,
        },
      }),
      this.prisma.purchaseBatch.count({
        where: {
          status: 'IN_STOCK',
          quantityRemaining: { gt: 0 },
          createdAt: {
            lt: staleBatchCutoff,
          },
        },
      }),
      this.prisma.supplier.aggregate({
        _sum: {
          balance: true,
        },
        where: {
          balance: {
            gt: 0,
          },
        },
      }),
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
    ]);

    const monthlyCashFlowNet = monthlyTransactions.reduce(
      (sum, transaction) => {
        return transaction.type === TransactionType.INCOME
          ? sum + transaction.amount
          : sum - transaction.amount;
      },
      0,
    );

    const badgeProductIds = [
      topSellingProductRaw[0]?.productId,
      lowestSellingProductRaw[0]?.productId,
    ].filter((value): value is string => Boolean(value));

    const badgeProducts = badgeProductIds.length
      ? await this.prisma.product.findMany({
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
        })
      : [];

    const productNameById = new Map(
      badgeProducts.map((product) => [product.id, product.name]),
    );
    const productImageById = new Map(
      badgeProducts.map((product) => [
        product.id,
        product.images[0]?.url || null,
      ]),
    );

    const topSellingProduct = this.toProductSalesBadge(
      topSellingProductRaw[0],
      productNameById,
      productImageById,
    );
    const lowestSellingProduct = this.toProductSalesBadge(
      lowestSellingProductRaw[0],
      productNameById,
      productImageById,
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
      supplierPendingBalance: supplierBalanceAggregate._sum.balance || 0,
      monthlyCashFlowNet,
      topSellingProduct,
      lowestSellingProduct,
    };
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
