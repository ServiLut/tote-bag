import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  SaleLegalRequirement,
  SaleLegalStatus,
  ShipmentStatus,
} from '../../generated/client/client';
import { PrismaService } from '../../prisma/prisma.service';

type NormalizedShippingAddress = Record<string, unknown> & {
  city: string;
};

type OrdersWithoutShipmentQueryResult = {
  id: string;
  orderNumber: number;
  customerEmail: string;
  totalAmount: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  createdAt: Date;
  city: string;
  status: OrderStatus;
  saleLegalRequirement: SaleLegalRequirement;
  saleLegalStatus: SaleLegalStatus;
  trackingNumber: string | null;
  carrier: string | null;
  shippingAddress: Prisma.JsonValue;
  profile: {
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type PendingShipmentRecord = {
  id: string;
  orderId: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
  weight: null;
  dimensions: null;
  provider: { id: string; name: string } | null;
  order: {
    orderNumber: number;
    customerEmail: string;
    totalAmount: Prisma.Decimal;
    createdAt: Date;
    shippingAddress: NormalizedShippingAddress;
    balanceDue: Prisma.Decimal;
    saleLegalRequirement: SaleLegalRequirement;
    saleLegalStatus: SaleLegalStatus;
    profile: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
  returnInfo: null;
};

@Injectable()
export class ShippingSyncService {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private isReturnedToStockEnumMismatch(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2007' &&
      error.message.includes('RETURNED_TO_STOCK')
    );
  }

  private requiresShipment(status: OrderStatus) {
    switch (status) {
      case OrderStatus.PAGADA:
      case OrderStatus.EN_PRODUCCION:
      case OrderStatus.IN_PRODUCTION:
      case OrderStatus.READY_FOR_DISPATCH:
      case OrderStatus.ENVIADA:
      case OrderStatus.ENTREGADA:
      case OrderStatus.RETURNED_TO_STOCK:
        return true;
      default:
        return false;
    }
  }

  private resolveShipmentStatus(status: OrderStatus): ShipmentStatus {
    switch (status) {
      case OrderStatus.ENVIADA:
        return ShipmentStatus.SHIPPED;
      case OrderStatus.ENTREGADA:
        return ShipmentStatus.DELIVERED;
      case OrderStatus.READY_FOR_DISPATCH:
        return ShipmentStatus.READY_TO_SHIP;
      case OrderStatus.RETURNED_TO_STOCK:
        return ShipmentStatus.RETURNED;
      case OrderStatus.CANCELADA:
        return ShipmentStatus.CANCELLED;
      default:
        return ShipmentStatus.PENDING;
    }
  }

  private normalizeShippingAddress(
    shippingAddress: Prisma.JsonValue,
    fallbackCity: string,
  ): NormalizedShippingAddress {
    if (
      !shippingAddress ||
      typeof shippingAddress !== 'object' ||
      Array.isArray(shippingAddress)
    ) {
      return { city: fallbackCity };
    }

    const normalized = shippingAddress as Record<string, unknown>;

    return {
      ...normalized,
      city:
        typeof normalized.city === 'string' && normalized.city.trim().length > 0
          ? normalized.city
          : fallbackCity,
    };
  }

  private readTrimmedString(
    record: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = record[key];

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private extractShippingProviderSnapshot(
    shippingAddress: Prisma.JsonValue,
    fallbackCarrier: string | null,
    fallbackCity = '',
  ): {
    providerId: string | null;
    providerName: string | null;
    shippingAddress: NormalizedShippingAddress;
  } {
    const normalizedAddress = this.normalizeShippingAddress(
      shippingAddress,
      fallbackCity,
    );

    const providerId = this.readTrimmedString(
      normalizedAddress,
      'shippingProviderId',
    );
    const providerNameFromAddress = this.readTrimmedString(
      normalizedAddress,
      'shippingProviderName',
    );

    return {
      providerId,
      providerName: fallbackCarrier?.trim() || providerNameFromAddress,
      shippingAddress: normalizedAddress,
    };
  }

  private getShipmentStatusRank(status: ShipmentStatus) {
    switch (status) {
      case ShipmentStatus.PENDING:
        return 1;
      case ShipmentStatus.READY_TO_SHIP:
        return 2;
      case ShipmentStatus.SHIPPED:
        return 3;
      case ShipmentStatus.IN_TRANSIT:
        return 4;
      case ShipmentStatus.DELIVERED:
        return 5;
      case ShipmentStatus.RETURNED:
        return 6;
      case ShipmentStatus.CANCELLED:
        return 7;
      default:
        return 0;
    }
  }

  private shouldPromoteShipmentStatus(
    current: ShipmentStatus,
    target: ShipmentStatus,
  ) {
    return (
      this.getShipmentStatusRank(target) > this.getShipmentStatusRank(current)
    );
  }

  async ensureShipmentForOrder(orderId: string, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    const order = await client.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        carrier: true,
        shippingAddress: true,
        shipment: {
          select: {
            id: true,
            providerId: true,
            trackingNumber: true,
            status: true,
            weight: true,
            dimensions: true,
            createdAt: true,
            updatedAt: true,
            shippedAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!order || !this.requiresShipment(order.status)) {
      return null;
    }

    const { providerId } = this.extractShippingProviderSnapshot(
      order.shippingAddress,
      order.carrier,
      '',
    );
    const inferredStatus = this.resolveShipmentStatus(order.status);

    if (!order.shipment) {
      return client.shipment.create({
        data: {
          orderId: order.id,
          providerId,
          trackingNumber: order.trackingNumber || null,
          status: inferredStatus,
          shippedAt:
            inferredStatus === ShipmentStatus.SHIPPED ||
            inferredStatus === ShipmentStatus.IN_TRANSIT ||
            inferredStatus === ShipmentStatus.DELIVERED
              ? new Date()
              : null,
          deliveredAt:
            inferredStatus === ShipmentStatus.DELIVERED ? new Date() : null,
        },
      });
    }

    const updateData: {
      providerId?: string | null;
      trackingNumber?: string | null;
      status?: ShipmentStatus;
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
    } = {};

    if (!order.shipment.providerId && providerId) {
      updateData.providerId = providerId;
    }

    if (!order.shipment.trackingNumber && order.trackingNumber) {
      updateData.trackingNumber = order.trackingNumber;
    }

    if (
      this.shouldPromoteShipmentStatus(order.shipment.status, inferredStatus)
    ) {
      updateData.status = inferredStatus;

      if (
        (inferredStatus === ShipmentStatus.SHIPPED ||
          inferredStatus === ShipmentStatus.IN_TRANSIT ||
          inferredStatus === ShipmentStatus.DELIVERED) &&
        !order.shipment.shippedAt
      ) {
        updateData.shippedAt = new Date();
      }

      if (
        inferredStatus === ShipmentStatus.DELIVERED &&
        !order.shipment.deliveredAt
      ) {
        updateData.deliveredAt = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return order.shipment;
    }

    return client.shipment.update({
      where: { orderId: order.id },
      data: updateData,
    });
  }

  async getOrdersWithoutShipmentRecords(tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    const shipmentEligibleStatuses = [
      OrderStatus.PAGADA,
      OrderStatus.EN_PRODUCCION,
      OrderStatus.IN_PRODUCTION,
      OrderStatus.READY_FOR_DISPATCH,
      OrderStatus.ENVIADA,
      OrderStatus.ENTREGADA,
      OrderStatus.RETURNED_TO_STOCK,
    ];

    const buildOrdersWithoutShipmentQuery = (statuses: OrderStatus[]) =>
      client.order.findMany({
        where: {
          shipment: null,
          status: {
            in: statuses,
          },
        },
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          totalAmount: true,
          balanceDue: true,
          createdAt: true,
          city: true,
          status: true,
          saleLegalRequirement: true,
          saleLegalStatus: true,
          trackingNumber: true,
          carrier: true,
          shippingAddress: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

    let orders: OrdersWithoutShipmentQueryResult[];

    try {
      orders = (await buildOrdersWithoutShipmentQuery(
        shipmentEligibleStatuses,
      )) as OrdersWithoutShipmentQueryResult[];
    } catch (error) {
      if (!this.isReturnedToStockEnumMismatch(error)) {
        throw error;
      }

      orders = (await buildOrdersWithoutShipmentQuery(
        shipmentEligibleStatuses.filter(
          (status) => status !== OrderStatus.RETURNED_TO_STOCK,
        ),
      )) as OrdersWithoutShipmentQueryResult[];
    }

    if (orders.length === 0) {
      return [];
    }

    const providerIds: string[] = Array.from(
      new Set(
        orders
          .map(
            (order) =>
              this.extractShippingProviderSnapshot(
                order.shippingAddress,
                order.carrier,
                order.city,
              ).providerId,
          )
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const providerMap = new Map<string, { id: string; name: string }>();

    if (providerIds.length > 0) {
      const providers = await client.shippingProvider.findMany({
        where: { id: { in: providerIds } },
        select: { id: true, name: true },
      });

      for (const provider of providers) {
        providerMap.set(provider.id, provider);
      }
    }

    return orders.map<PendingShipmentRecord>((order) => {
      const { providerId, providerName, shippingAddress } =
        this.extractShippingProviderSnapshot(
          order.shippingAddress,
          order.carrier,
          order.city,
        );
      const provider =
        (providerId ? providerMap.get(providerId) : null) ||
        (providerName
          ? { id: providerId ?? `carrier-${order.id}`, name: providerName }
          : null);

      return {
        id: `pending-${order.id}`,
        orderId: order.id,
        trackingNumber: order.trackingNumber || null,
        status: this.resolveShipmentStatus(order.status),
        weight: null,
        dimensions: null,
        provider,
        order: {
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          totalAmount: order.totalAmount,
          balanceDue: order.balanceDue,
          createdAt: order.createdAt,
          shippingAddress,
          saleLegalRequirement: order.saleLegalRequirement,
          saleLegalStatus: order.saleLegalStatus,
          profile: order.profile,
        },
        returnInfo: null,
      };
    });
  }
}
