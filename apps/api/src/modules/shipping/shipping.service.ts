import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { ShippingNotifierService } from './shipping-notifier.service';
import { ShippingSyncService } from './shipping-sync.service';
import { InventoryService } from '../inventory/inventory.service';
import { decimalToNumber, toDecimal } from '../../common/utils/sales-tax.util';
import { CreateShippingProviderDto } from './dto/create-provider.dto';
import {
  ProcessReturnDto,
  ReturnProductCondition,
  ReturnReason,
} from './dto/process-return.dto';
import { UpdateShippingProviderDto } from './dto/update-provider.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import {
  BatchStatus,
  ShipmentStatus,
  OrderStatus,
  Prisma,
  Role,
} from '../../generated/client/client';

const RETURN_ACTION = 'PROCESS_SHIPMENT_RETURN';

type ShipmentListItem = {
  id: string;
  orderId: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
  weight: number | null;
  dimensions: string | null;
  provider: { id: string; name: string } | null;
  order: {
    orderNumber: number;
    customerEmail: string;
    totalAmount: number;
    createdAt: Date;
    shippingAddress?: unknown;
    profile?: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
  returnInfo:
    | (ReturnPayloadSnapshot & {
        processedAt: Date | null;
      })
    | null;
};

type ReturnPayloadSnapshot = {
  reason?: string;
  reasonLabel?: string;
  productCondition?: string;
  productConditionLabel?: string;
  restock?: boolean;
  returnTrackingNumber?: string;
};

const returnReasonLabels: Record<ReturnReason, string> = {
  [ReturnReason.WRONG_ADDRESS]: 'Direccion incorrecta',
  [ReturnReason.CUSTOMER_REJECTED]: 'Rechazado por cliente',
  [ReturnReason.DEFECTIVE_PRODUCT]: 'Producto defectuoso',
};

const productConditionLabels: Record<ReturnProductCondition, string> = {
  [ReturnProductCondition.PERFECT]: 'Nuevo/Perfecto',
  [ReturnProductCondition.DAMAGED]: 'Danado',
  [ReturnProductCondition.USED]: 'Usado',
};

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly shippingProviderPublicSelect = {
    id: true,
    name: true,
    contact: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.ShippingProviderSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingNotifier: ShippingNotifierService,
    private readonly shippingSyncService: ShippingSyncService,
    private readonly inventoryService: InventoryService,
  ) {}

  private isReturnedToStockEnumMismatch(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2007' &&
      error.message.includes('RETURNED_TO_STOCK')
    );
  }

  private rethrowProviderMutationError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Proveedor no encontrado');
      }

      if (error.code === 'P2003') {
        throw new ConflictException(
          'No se puede eliminar el proveedor porque tiene envios asociados',
        );
      }
    }

    throw error;
  }

  private isDispatchedStatus(status: ShipmentStatus | undefined) {
    return (
      status === ShipmentStatus.SHIPPED || status === ShipmentStatus.IN_TRANSIT
    );
  }

  private toMoney(value: unknown) {
    return new Decimal(
      value && typeof value === 'object' && 'toString' in value
        ? value.toString()
        : String(value ?? 0),
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private async consumeDispatchSupplyIfConfigured(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId?: string,
  ) {
    const securityBagVariantId =
      process.env.SECURITY_BAG_VARIANT_ID?.trim() || '';
    const securityBagSku = process.env.SECURITY_BAG_VARIANT_SKU?.trim();

    if (!securityBagVariantId && !securityBagSku) {
      await tx.auditLog.create({
        data: {
          action: 'DISPATCH_SUPPLY_NOT_CONFIGURED',
          entity: 'Order',
          entityId: orderId,
          userId: userId ?? null,
          payload: {
            reason: 'SECURITY_BAG_VARIANT_ID_OR_SKU_NOT_CONFIGURED',
            expectedEnvVars: [
              'SECURITY_BAG_VARIANT_ID',
              'SECURITY_BAG_VARIANT_SKU',
            ],
          },
        },
      });
      return;
    }

    const variant = securityBagVariantId
      ? await tx.variant.findUnique({
          where: { id: securityBagVariantId },
          select: { id: true, sku: true },
        })
      : await tx.variant.findUnique({
          where: { sku: securityBagSku },
          select: { id: true, sku: true },
        });

    if (!variant) {
      await tx.auditLog.create({
        data: {
          action: 'DISPATCH_SUPPLY_MISSING',
          entity: 'Order',
          entityId: orderId,
          userId: userId ?? null,
          payload: {
            reason: securityBagVariantId
              ? 'SECURITY_BAG_VARIANT_ID_NOT_FOUND'
              : 'SECURITY_BAG_VARIANT_SKU_NOT_FOUND',
            variantId: securityBagVariantId || null,
            sku: securityBagSku || null,
          },
        },
      });
      return;
    }

    const reduction = await this.inventoryService.reduceStockFIFO(
      variant.id,
      1,
      userId,
      tx,
    );

    await tx.auditLog.create({
      data: {
        action: 'CONSUME_DISPATCH_SUPPLY',
        entity: 'Order',
        entityId: orderId,
        userId: userId ?? null,
        payload: {
          sku: variant.sku,
          quantity: 1,
          inventoryConsumption: reduction,
        },
      },
    });
  }

  // --- Shipping Providers CRUD ---

  async createProvider(dto: CreateShippingProviderDto) {
    return this.prisma.shippingProvider.create({
      data: dto,
      select: this.shippingProviderPublicSelect,
    });
  }

  async getProviders() {
    return this.prisma.shippingProvider.findMany({
      select: this.shippingProviderPublicSelect,
      orderBy: { name: 'asc' },
    });
  }

  async getProviderById(id: string) {
    const provider = await this.prisma.shippingProvider.findUnique({
      where: { id },
      select: this.shippingProviderPublicSelect,
    });
    if (!provider) throw new NotFoundException('Proveedor no encontrado');
    return provider;
  }

  async updateProvider(id: string, dto: UpdateShippingProviderDto) {
    try {
      return await this.prisma.shippingProvider.update({
        where: { id },
        data: dto,
        select: this.shippingProviderPublicSelect,
      });
    } catch (error) {
      this.rethrowProviderMutationError(error);
    }
  }

  async deleteProvider(id: string) {
    try {
      return await this.prisma.shippingProvider.delete({
        where: { id },
        select: this.shippingProviderPublicSelect,
      });
    } catch (error) {
      this.rethrowProviderMutationError(error);
    }
  }

  // --- Shipments Management ---

  async getPendingShipments() {
    // Órdenes pagadas que no tienen envío o envío está PENDING o READY_TO_SHIP
    return this.prisma.order.findMany({
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
      include: {
        shipment: {
          include: { provider: true },
        },
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private extractInventoryConsumption(
    pricingJson: Prisma.JsonValue | null,
  ): Array<{
    batchId: string;
    supplierId: string;
    quantity: number;
    unitCost: number;
  }> {
    if (
      !pricingJson ||
      typeof pricingJson !== 'object' ||
      Array.isArray(pricingJson)
    ) {
      return [];
    }

    const inventoryConsumption = (pricingJson as Record<string, unknown>)
      .inventoryConsumption;

    if (
      !inventoryConsumption ||
      typeof inventoryConsumption !== 'object' ||
      Array.isArray(inventoryConsumption)
    ) {
      return [];
    }

    const reductions = (inventoryConsumption as Record<string, unknown>)
      .reductions;

    if (!Array.isArray(reductions)) {
      return [];
    }

    return reductions.flatMap((reduction) => {
      if (
        !reduction ||
        typeof reduction !== 'object' ||
        Array.isArray(reduction)
      ) {
        return [];
      }

      const candidate = reduction as Record<string, unknown>;
      if (
        typeof candidate.batchId !== 'string' ||
        typeof candidate.supplierId !== 'string' ||
        typeof candidate.quantity !== 'number' ||
        typeof candidate.unitCost !== 'number'
      ) {
        return [];
      }

      return [
        {
          batchId: candidate.batchId,
          supplierId: candidate.supplierId,
          quantity: candidate.quantity,
          unitCost: candidate.unitCost,
        },
      ];
    });
  }

  private extractReturnPayloadSnapshot(
    payload: Prisma.JsonValue | null,
  ): ReturnPayloadSnapshot | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const snapshot = payload as Record<string, unknown>;

    return {
      reason: typeof snapshot.reason === 'string' ? snapshot.reason : undefined,
      reasonLabel:
        typeof snapshot.reasonLabel === 'string'
          ? snapshot.reasonLabel
          : undefined,
      productCondition:
        typeof snapshot.productCondition === 'string'
          ? snapshot.productCondition
          : undefined,
      productConditionLabel:
        typeof snapshot.productConditionLabel === 'string'
          ? snapshot.productConditionLabel
          : undefined,
      restock:
        typeof snapshot.restock === 'boolean' ? snapshot.restock : undefined,
      returnTrackingNumber:
        typeof snapshot.returnTrackingNumber === 'string'
          ? snapshot.returnTrackingNumber
          : undefined,
    };
  }

  private async resolveFallbackReturnBatchSource(
    tx: Prisma.TransactionClient,
    item: {
      productId: string;
      variantId: string | null;
    },
  ) {
    const historicalBatches = await tx.purchaseBatch.findMany({
      where: {
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
      },
      select: {
        supplierId: true,
        quantityReceived: true,
        unitCost: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const supplierId =
      historicalBatches[0]?.supplierId ||
      (
        await tx.supplier.findFirst({
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        })
      )?.id;

    if (!supplierId) {
      throw new BadRequestException(
        'No hay proveedor disponible para reconstruir el lote de devolución',
      );
    }

    const totalUnits = historicalBatches.reduce(
      (sum, batch) => sum + batch.quantityReceived,
      0,
    );
    const weightedUnitCost =
      totalUnits > 0
        ? decimalToNumber(
            historicalBatches
              .reduce(
                (sum, batch) =>
                  sum.plus(
                    toDecimal(batch.unitCost).mul(batch.quantityReceived),
                  ),
                new Decimal(0),
              )
              .div(totalUnits),
          )
        : 0;

    return {
      supplierId,
      unitCost: weightedUnitCost,
    };
  }

  private async restockOrderItem(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      orderNumber: number;
      shipmentId: string;
    },
    item: {
      productId: string;
      product: { name: string };
      variantId: string | null;
      sku: string;
      quantity: number;
      pricingJson: Prisma.JsonValue | null;
    },
    reason: ReturnReason,
    userId: string,
  ) {
    if (!item.variantId) {
      return;
    }

    const exactReductions = this.extractInventoryConsumption(item.pricingJson);
    const reductions =
      exactReductions.length > 0
        ? exactReductions
        : [
            {
              ...(await this.resolveFallbackReturnBatchSource(tx, item)),
              batchId: `fallback-${item.variantId}`,
              quantity: item.quantity,
              isEstimated: true,
            },
          ];

    let totalRestocked = 0;
    const reconstructionMode =
      exactReductions.length > 0 ? 'exact_inventory_consumption' : 'estimated';

    for (const reduction of reductions) {
      if (reduction.quantity <= 0) {
        continue;
      }

      totalRestocked += reduction.quantity;

      await tx.purchaseBatch.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          supplierId: reduction.supplierId,
          quantityReceived: reduction.quantity,
          quantityRemaining: reduction.quantity,
          unitCost: reduction.unitCost,
          totalCost: reduction.quantity * reduction.unitCost,
          status: BatchStatus.IN_STOCK,
        },
      });
    }

    if (totalRestocked > 0) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stock: { increment: totalRestocked },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'RETURN_TO_STOCK',
        entity: 'Variant',
        entityId: item.variantId,
        userId,
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          shipmentId: order.shipmentId,
          reason,
          quantityReturned: totalRestocked,
          productId: item.productId,
          productName: item.product.name,
          variantId: item.variantId,
          sku: item.sku,
          reference: `RETURN-${order.id}`,
          reconstructionMode,
        },
      },
    });
  }

  async getOrderAndShipment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { profile: true },
    });

    if (!order) throw new NotFoundException('Orden no encontrada');

    const shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
    });

    if (!shipment) throw new NotFoundException('Envío no encontrado');

    return { order, shipment };
  }

  async getShipments(): Promise<ShipmentListItem[]> {
    const shipments = await this.prisma.shipment.findMany({
      include: {
        order: {
          include: {
            profile: true,
          },
        },
        provider: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (shipments.length === 0) {
      return this.shippingSyncService.getOrdersWithoutShipmentRecords();
    }

    const returnLogs = await this.prisma.auditLog.findMany({
      where: {
        action: RETURN_ACTION,
        entity: 'Shipment',
        entityId: {
          in: shipments.map((shipment) => shipment.id),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const latestReturnByShipmentId = new Map<
      string,
      (typeof returnLogs)[number]
    >();

    for (const log of returnLogs) {
      if (!log.entityId || latestReturnByShipmentId.has(log.entityId)) {
        continue;
      }

      latestReturnByShipmentId.set(log.entityId, log);
    }

    const normalizedShipments: ShipmentListItem[] = shipments.map(
      (shipment) => {
        const returnLog = latestReturnByShipmentId.get(shipment.id);
        const payload = this.extractReturnPayloadSnapshot(
          returnLog?.payload ?? null,
        );

        return {
          ...shipment,
          returnInfo: payload
            ? {
                reason: payload.reason,
                reasonLabel: payload.reasonLabel,
                productCondition: payload.productCondition,
                productConditionLabel: payload.productConditionLabel,
                restock: payload.restock,
                returnTrackingNumber: payload.returnTrackingNumber,
                processedAt: returnLog?.createdAt ?? null,
              }
            : null,
        };
      },
    );

    const ordersWithoutShipment =
      await this.shippingSyncService.getOrdersWithoutShipmentRecords();

    return [...normalizedShipments, ...ordersWithoutShipment].sort(
      (a, b) =>
        new Date(b.order.createdAt).getTime() -
        new Date(a.order.createdAt).getTime(),
    );
  }

  async updateShipment(
    orderId: string,
    dto: UpdateShipmentDto,
    userId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        trackingNumber: true,
        carrier: true,
        balanceDue: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (
      this.isDispatchedStatus(dto.status) &&
      this.toMoney(order.balanceDue).greaterThan(0)
    ) {
      throw new ForbiddenException(
        'La orden no puede despacharse con saldo pendiente',
      );
    }

    // Buscar si existe el envío para esta orden
    let shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
    });
    const wasDispatched = this.isDispatchedStatus(shipment?.status);

    let carrierName: string | null = order.carrier;

    if (dto.providerId) {
      const provider = await this.prisma.shippingProvider.findUnique({
        where: { id: dto.providerId },
        select: { name: true },
      });
      if (!provider) {
        throw new NotFoundException('Proveedor no encontrado');
      }
      carrierName = provider?.name ?? carrierName;
    }

    if (!shipment) {
      const isDispatched = this.isDispatchedStatus(dto.status);
      // Crear envío si no existe
      shipment = await this.prisma.shipment.create({
        data: {
          orderId,
          ...dto,
          status: dto.status || ShipmentStatus.PENDING,
          shippedAt: isDispatched ? new Date() : null,
          deliveredAt:
            dto.status === ShipmentStatus.DELIVERED ? new Date() : null,
        },
      });
    } else {
      // Actualizar envío
      const data: Prisma.ShipmentUpdateInput = { ...dto };
      if (
        this.isDispatchedStatus(dto.status) &&
        !this.isDispatchedStatus(shipment.status) &&
        shipment.status !== ShipmentStatus.DELIVERED
      ) {
        data.shippedAt = new Date();
      }
      if (
        dto.status === ShipmentStatus.DELIVERED &&
        shipment.status !== ShipmentStatus.DELIVERED
      ) {
        if (!shipment.shippedAt) {
          data.shippedAt = new Date();
        }
        data.deliveredAt = new Date();
      }

      shipment = await this.prisma.shipment.update({
        where: { orderId },
        data,
      });
    }

    // Si el estado cambia a SHIPPED, enviar notificación (placeholder)
    if (this.isDispatchedStatus(dto.status)) {
      if (!wasDispatched) {
        await this.prisma.$transaction((tx) =>
          this.consumeDispatchSupplyIfConfigured(tx, orderId, userId),
        );
      }

      await this.shippingNotifier.notifyShipmentDispatched(
        orderId,
        shipment.trackingNumber ?? undefined,
      );
    }

    // Actualizar también el estado de la orden si corresponde
    if (this.isDispatchedStatus(dto.status)) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ENVIADA,
          trackingNumber:
            dto.trackingNumber ?? order.trackingNumber ?? undefined,
          carrier: carrierName ?? undefined,
          ...(order.status !== OrderStatus.ENVIADA
            ? {
                statusHistory: {
                  create: {
                    status: OrderStatus.ENVIADA,
                  },
                },
              }
            : {}),
        },
      });
    } else if (dto.status === ShipmentStatus.DELIVERED) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ENTREGADA,
          trackingNumber:
            dto.trackingNumber ?? order.trackingNumber ?? undefined,
          carrier: carrierName ?? undefined,
          ...(order.status !== OrderStatus.ENTREGADA
            ? {
                statusHistory: {
                  create: {
                    status: OrderStatus.ENTREGADA,
                  },
                },
              }
            : {}),
        },
      });
    } else if (dto.trackingNumber || dto.providerId) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          trackingNumber:
            dto.trackingNumber ?? order.trackingNumber ?? undefined,
          carrier: carrierName ?? undefined,
        },
      });
    }

    return shipment;
  }

  async processReturn(orderId: string, dto: ProcessReturnDto, userId?: string) {
    if (
      dto.restock &&
      dto.productCondition !== ReturnProductCondition.PERFECT
    ) {
      throw new BadRequestException(
        'Solo se puede reingresar a stock un producto en estado perfecto',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          shipment: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Orden no encontrada');
      }

      if (!order.shipment) {
        throw new NotFoundException('Envio no encontrado');
      }

      if (
        order.shipment.status !== ShipmentStatus.RETURNED &&
        order.shipment.status !== ShipmentStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Solo se pueden procesar devoluciones de envios retornados o cancelados',
        );
      }

      const finalUserId =
        userId ||
        (
          await tx.user.findFirst({
            where: { role: Role.ADMIN },
            select: { id: true },
          })
        )?.id ||
        'SYSTEM_ADMIN_ID';

      if (dto.restock) {
        const restockableItems = order.items.filter((item) => item.variantId);

        if (restockableItems.length === 0) {
          throw new BadRequestException(
            'La orden no tiene variantes asociadas para reingresar a stock',
          );
        }

        for (const item of restockableItems) {
          await this.restockOrderItem(
            tx,
            {
              id: order.id,
              orderNumber: order.orderNumber,
              shipmentId: order.shipment.id,
            },
            item,
            dto.reason,
            finalUserId,
          );
        }
      }

      const updatedShipment = await tx.shipment.update({
        where: { orderId },
        data: {
          status: ShipmentStatus.RETURNED,
        },
      });

      const requestedOrderStatus = dto.restock
        ? OrderStatus.RETURNED_TO_STOCK
        : OrderStatus.CANCELADA;
      let persistedOrderStatus = requestedOrderStatus;

      try {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: requestedOrderStatus,
            statusHistory: {
              create: {
                status: requestedOrderStatus,
              },
            },
          },
        });
      } catch (error) {
        if (
          requestedOrderStatus !== OrderStatus.RETURNED_TO_STOCK ||
          !this.isReturnedToStockEnumMismatch(error)
        ) {
          throw error;
        }

        persistedOrderStatus = OrderStatus.CANCELADA;

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: persistedOrderStatus,
            statusHistory: {
              create: {
                status: persistedOrderStatus,
              },
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: RETURN_ACTION,
          entity: 'Shipment',
          entityId: order.shipment.id,
          userId: finalUserId,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shipmentId: order.shipment.id,
            previousShipmentStatus: order.shipment.status,
            newShipmentStatus: ShipmentStatus.RETURNED,
            previousOrderStatus: order.status,
            newOrderStatus: persistedOrderStatus,
            requestedOrderStatus:
              persistedOrderStatus !== requestedOrderStatus
                ? requestedOrderStatus
                : undefined,
            restock: dto.restock,
            reason: dto.reason,
            reasonLabel: returnReasonLabels[dto.reason],
            productCondition: dto.productCondition,
            productConditionLabel: productConditionLabels[dto.productCondition],
            returnTrackingNumber: dto.returnTrackingNumber ?? null,
          },
        },
      });

      return {
        shipment: updatedShipment,
        orderStatus: persistedOrderStatus,
      };
    });
  }

  private async sendShippingNotification(
    orderId: string,
    trackingNumber?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { profile: true },
    });

    if (!order) return;

    const email = order.customerEmail || order.profile?.email;
    if (!email) return;

    this.logger.log(
      `[NOTIFICACIÓN] Enviando correo a ${email} para orden #${order.orderNumber}. Guía: ${trackingNumber || 'N/A'}`,
    );

    // TODO: Integrar con servicio de correo real (SendGrid, AWS SES, etc.)
    // console.log(`Hola, tu pedido #${order.orderNumber} ha sido enviado. Tracking: ${trackingNumber}`);
  }
}
