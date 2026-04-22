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
  PurchaseBatchItemType,
  SupplyItemType,
  InventoryAdjustmentItemType,
  InventoryMovementReason,
  SaleLegalRequirement,
  SaleLegalStatus,
} from '../../generated/client/client';

const RETURN_ACTION = 'PROCESS_SHIPMENT_RETURN';
const SHIPPING_BAG_CONSUMPTION_ACTION = 'CONSUME_SHIPPING_BAG_FIFO';

type ShipmentListItem = {
  id: string;
  orderId: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
  weight: Decimal | null;
  dimensions: string | null;
  provider: { id: string; name: string } | null;
  order: {
    orderNumber: number;
    customerEmail: string;
    totalAmount: Decimal;
    createdAt: Date;
    shippingAddress?: unknown;
    balanceDue: Decimal;
    saleLegalRequirement: SaleLegalRequirement;
    saleLegalStatus: SaleLegalStatus;
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

  private isShipmentPastDispatch(status: ShipmentStatus | undefined) {
    return (
      this.isDispatchedStatus(status) || status === ShipmentStatus.DELIVERED
    );
  }

  private assertSaleLegalClosureAllowed(order: {
    saleLegalRequirement: SaleLegalRequirement;
    saleLegalStatus: SaleLegalStatus;
  }) {
    if (order.saleLegalStatus === SaleLegalStatus.COMPLETED) {
      return;
    }

    if (
      order.saleLegalRequirement ===
      SaleLegalRequirement.PENDING_STOCK_ASSIGNMENT
    ) {
      throw new ForbiddenException(
        'La orden no puede despacharse sin asignacion FIFO real de lote',
      );
    }

    throw new ForbiddenException(
      order.saleLegalRequirement ===
        SaleLegalRequirement.ELECTRONIC_INVOICE_REQUIRED
        ? 'La orden usa stock de lote con factura y exige factura electronica antes del despacho'
        : 'La orden usa stock de lote con remision y exige registrar factura o remision interna antes del despacho',
    );
  }

  private toMoney(value: unknown) {
    if (value instanceof Decimal) {
      return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    if (
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'bigint'
    ) {
      return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    return new Decimal(0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private toQuantity(value: Decimal.Value) {
    const quantity = new Decimal(value).toDecimalPlaces(
      3,
      Decimal.ROUND_HALF_UP,
    );

    if (!quantity.isFinite()) {
      throw new BadRequestException('La cantidad de bolsas no es valida');
    }

    return quantity;
  }

  private quantityToNumber(value: Decimal.Value | null | undefined) {
    if (value === null || value === undefined) return 0;
    return new Decimal(value).toNumber();
  }

  private validateShippingBagQuantity(quantity: number | undefined) {
    if (quantity === undefined || quantity === null) {
      throw new BadRequestException(
        'Indica cuantas bolsas de envio se usaran en este despacho',
      );
    }

    const parsedQuantity = this.toQuantity(quantity);
    if (parsedQuantity.lte(0)) {
      throw new BadRequestException(
        'La cantidad de bolsas de envio debe ser mayor a cero',
      );
    }

    return parsedQuantity;
  }

  private async consumeShippingBagsFIFO(
    tx: Prisma.TransactionClient,
    params: {
      shipmentId: string;
      orderId: string;
      supplyItemId: string;
      quantity: Decimal;
      userId?: string;
    },
  ) {
    const existingUsage = await tx.shipmentSupplyUsage.findFirst({
      where: {
        shipmentId: params.shipmentId,
        supplyItemId: params.supplyItemId,
      },
      select: { id: true },
    });

    if (existingUsage) {
      throw new BadRequestException(
        'Este envio ya tiene consumo registrado para ese insumo',
      );
    }

    const supplyItem = await tx.supplyItem.findUnique({
      where: { id: params.supplyItemId },
      select: {
        id: true,
        name: true,
        sku: true,
        supplyType: true,
        isActive: true,
      },
    });

    if (!supplyItem || !supplyItem.isActive) {
      throw new NotFoundException('Bolsa de envio no encontrada');
    }

    if (supplyItem.supplyType !== SupplyItemType.SHIPPING_BAG) {
      throw new BadRequestException(
        'El insumo seleccionado no esta configurado como bolsa de envio',
      );
    }

    const lines = await tx.purchaseBatchLine.findMany({
      where: {
        itemType: PurchaseBatchItemType.SUPPLY,
        supplyItemId: params.supplyItemId,
        status: BatchStatus.IN_STOCK,
        quantityRemaining: { gt: 0 },
        purchaseBatch: { status: BatchStatus.IN_STOCK },
      },
      include: {
        purchaseBatch: {
          select: {
            id: true,
            supplierId: true,
            createdAt: true,
            variantId: true,
          },
        },
      },
      orderBy: [
        { purchaseBatch: { createdAt: 'asc' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    const available = lines.reduce(
      (sum, line) => sum.plus(line.quantityRemaining),
      new Decimal(0),
    );

    if (available.lt(params.quantity)) {
      throw new BadRequestException(
        `Stock insuficiente de bolsas de envio. Disponible: ${available.toString()}, solicitado: ${params.quantity.toString()}`,
      );
    }

    const usage = await tx.shipmentSupplyUsage.create({
      data: {
        shipmentId: params.shipmentId,
        supplyItemId: params.supplyItemId,
        quantityUsed: params.quantity,
      },
      select: { id: true },
    });

    let remaining = params.quantity;
    const allocations: Array<{
      purchaseBatchLineId: string;
      purchaseBatchId: string;
      supplierId: string;
      quantityAllocated: number;
    }> = [];

    for (const line of lines) {
      if (remaining.lte(0)) break;

      const lineAvailable = new Decimal(line.quantityRemaining);
      const quantityToAllocate = Decimal.min(remaining, lineAvailable);
      const updatedLines = await tx.purchaseBatchLine.updateMany({
        where: {
          id: line.id,
          quantityRemaining: { gte: quantityToAllocate },
          status: BatchStatus.IN_STOCK,
        },
        data: {
          quantityRemaining: { decrement: quantityToAllocate },
        },
      });

      if (updatedLines.count !== 1) {
        throw new ConflictException(
          'El stock de bolsas cambio mientras se confirmaba el envio. Intenta nuevamente.',
        );
      }

      const updatedLine = await tx.purchaseBatchLine.findUnique({
        where: { id: line.id },
        select: { quantityRemaining: true },
      });
      const lineRemaining = new Decimal(updatedLine?.quantityRemaining ?? 0);

      if (lineRemaining.lte(0)) {
        await tx.purchaseBatchLine.update({
          where: { id: line.id },
          data: { status: BatchStatus.DEPLETED },
        });
      }

      await tx.shipmentSupplyUsageAllocation.create({
        data: {
          shipmentSupplyUsageId: usage.id,
          purchaseBatchLineId: line.id,
          quantityAllocated: quantityToAllocate,
        },
      });

      const activeLines = await tx.purchaseBatchLine.count({
        where: {
          purchaseBatchId: line.purchaseBatchId,
          status: BatchStatus.IN_STOCK,
          quantityRemaining: { gt: 0 },
        },
      });
      const batchRemaining = await tx.purchaseBatchLine.aggregate({
        where: {
          purchaseBatchId: line.purchaseBatchId,
          status: BatchStatus.IN_STOCK,
        },
        _sum: { quantityRemaining: true },
      });

      await tx.purchaseBatch.update({
        where: { id: line.purchaseBatchId },
        data: {
          quantityRemaining: line.purchaseBatch.variantId
            ? this.quantityToNumber(batchRemaining._sum.quantityRemaining)
            : 0,
          status:
            activeLines === 0 ? BatchStatus.DEPLETED : BatchStatus.IN_STOCK,
        },
      });

      allocations.push({
        purchaseBatchLineId: line.id,
        purchaseBatchId: line.purchaseBatchId,
        supplierId: line.purchaseBatch.supplierId,
        quantityAllocated: quantityToAllocate.toNumber(),
      });

      remaining = remaining.minus(quantityToAllocate);
    }

    const updatedSupplyStock = await tx.supplyItem.updateMany({
      where: {
        id: params.supplyItemId,
        stock: { gte: params.quantity },
      },
      data: { stock: { decrement: params.quantity } },
    });

    if (updatedSupplyStock.count !== 1) {
      throw new ConflictException(
        'El stock consolidado de bolsas no coincide con los lotes disponibles. Revisa inventario antes de despachar.',
      );
    }

    const updatedSupplyItem = await tx.supplyItem.findUnique({
      where: { id: params.supplyItemId },
      select: { stock: true },
    });

    await tx.inventoryMovement.create({
      data: {
        reason: InventoryMovementReason.SHIPMENT_SUPPLY_USAGE,
        itemType: InventoryAdjustmentItemType.SUPPLY,
        quantity: params.quantity.negated(),
        balanceAfter: updatedSupplyItem?.stock ?? 0,
        userId: params.userId ?? null,
        supplyItemId: params.supplyItemId,
        orderId: params.orderId,
        metadata: {
          shipmentId: params.shipmentId,
          usageId: usage.id,
          allocations,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        action: SHIPPING_BAG_CONSUMPTION_ACTION,
        entity: 'ShipmentSupplyUsage',
        entityId: usage.id,
        userId: params.userId ?? null,
        payload: {
          shipmentId: params.shipmentId,
          orderId: params.orderId,
          supplyItemId: supplyItem.id,
          sku: supplyItem.sku,
          supplyType: supplyItem.supplyType,
          quantityUsed: params.quantity.toNumber(),
          allocations,
        },
      },
    });

    return {
      usageId: usage.id,
      supplyItemId: supplyItem.id,
      quantityUsed: params.quantity.toNumber(),
      allocations,
    };
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
    const movementEntries: Array<{
      batchId: string;
      batchLineId: string;
      quantity: number;
      unitCost: number;
    }> = [];

    for (const reduction of reductions) {
      if (reduction.quantity <= 0) {
        continue;
      }

      totalRestocked += reduction.quantity;

      const batch = await tx.purchaseBatch.create({
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

      const batchLine = await tx.purchaseBatchLine.create({
        data: {
          purchaseBatchId: batch.id,
          itemType: PurchaseBatchItemType.VARIANT,
          variantId: item.variantId,
          quantity: reduction.quantity,
          quantityRemaining: reduction.quantity,
          unitOfMeasure: 'und',
          unitCost: reduction.unitCost,
          lineTotal: reduction.quantity * reduction.unitCost,
          status: BatchStatus.IN_STOCK,
          notes: 'Linea generada por reingreso de devolucion',
        },
      });

      movementEntries.push({
        batchId: batch.id,
        batchLineId: batchLine.id,
        quantity: reduction.quantity,
        unitCost: reduction.unitCost,
      });
    }

    if (totalRestocked > 0) {
      const updatedVariant = await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stock: { increment: totalRestocked },
        },
      });
      let runningBalance = updatedVariant.stock - totalRestocked;

      for (const movementEntry of movementEntries) {
        runningBalance += movementEntry.quantity;

        await tx.inventoryMovement.create({
          data: {
            reason: InventoryMovementReason.RETURN_TO_STOCK,
            itemType: InventoryAdjustmentItemType.VARIANT,
            quantity: movementEntry.quantity,
            balanceAfter: runningBalance,
            userId,
            variantId: item.variantId,
            purchaseBatchId: movementEntry.batchId,
            purchaseBatchLineId: movementEntry.batchLineId,
            orderId: order.id,
            metadata: {
              shipmentId: order.shipmentId,
              reason,
              reconstructionMode,
              unitCost: movementEntry.unitCost,
            },
          },
        });
      }
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
          id: shipment.id,
          orderId: shipment.orderId,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          weight: shipment.weight,
          dimensions: shipment.dimensions,
          provider: shipment.provider
            ? {
                id: shipment.provider.id,
                name: shipment.provider.name,
              }
            : null,
          order: {
            orderNumber: shipment.order.orderNumber,
            customerEmail: shipment.order.customerEmail,
            totalAmount: shipment.order.totalAmount,
            createdAt: shipment.order.createdAt,
            shippingAddress: shipment.order.shippingAddress,
            balanceDue: shipment.order.balanceDue,
            saleLegalRequirement: shipment.order.saleLegalRequirement,
            saleLegalStatus: shipment.order.saleLegalStatus,
            profile: shipment.order.profile
              ? {
                  firstName: shipment.order.profile.firstName,
                  lastName: shipment.order.profile.lastName,
                }
              : null,
          },
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

  async getShippingBagAvailability() {
    const supplyItems = await this.prisma.supplyItem.findMany({
      where: {
        isActive: true,
        supplyType: SupplyItemType.SHIPPING_BAG,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unitOfMeasure: true,
        stock: true,
        minStock: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    if (supplyItems.length === 0) {
      return [];
    }

    const supplyItemIds = supplyItems.map((item) => item.id);
    const lineAvailability = await this.prisma.purchaseBatchLine.groupBy({
      by: ['supplyItemId'],
      where: {
        itemType: PurchaseBatchItemType.SUPPLY,
        supplyItemId: { in: supplyItemIds },
        status: BatchStatus.IN_STOCK,
        quantityRemaining: { gt: 0 },
        purchaseBatch: { status: BatchStatus.IN_STOCK },
      },
      _sum: { quantityRemaining: true },
    });

    const availableBySupplyItemId = new Map(
      lineAvailability.flatMap((entry) =>
        entry.supplyItemId
          ? [
              [
                entry.supplyItemId,
                this.quantityToNumber(entry._sum.quantityRemaining),
              ] as const,
            ]
          : [],
      ),
    );

    return supplyItems.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      stock: this.quantityToNumber(item.stock),
      minStock: this.quantityToNumber(item.minStock),
      availableQuantity: availableBySupplyItemId.get(item.id) ?? 0,
    }));
  }

  async getShipmentSupplyUsage(orderId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
      select: {
        id: true,
        orderId: true,
        supplyUsages: {
          include: {
            supplyItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                supplyType: true,
                unitOfMeasure: true,
              },
            },
            allocations: {
              include: {
                purchaseBatchLine: {
                  include: {
                    purchaseBatch: {
                      include: {
                        supplier: {
                          select: {
                            id: true,
                            name: true,
                            nit: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Envio no encontrado');
    }

    return {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      usages: shipment.supplyUsages.map((usage) => ({
        id: usage.id,
        supplyItem: usage.supplyItem,
        quantityUsed: this.quantityToNumber(usage.quantityUsed),
        createdAt: usage.createdAt,
        allocations: usage.allocations.map((allocation) => ({
          id: allocation.id,
          purchaseBatchLineId: allocation.purchaseBatchLineId,
          purchaseBatchId: allocation.purchaseBatchLine.purchaseBatchId,
          quantityAllocated: this.quantityToNumber(
            allocation.quantityAllocated,
          ),
          unitCost: decimalToNumber(allocation.purchaseBatchLine.unitCost),
          lineRemaining: this.quantityToNumber(
            allocation.purchaseBatchLine.quantityRemaining,
          ),
          batchCreatedAt: allocation.purchaseBatchLine.purchaseBatch.createdAt,
          supplier: allocation.purchaseBatchLine.purchaseBatch.supplier,
          createdAt: allocation.createdAt,
        })),
      })),
    };
  }

  async updateShipment(
    orderId: string,
    dto: UpdateShipmentDto,
    userId?: string,
  ) {
    const { shippingBagSupplyItemId, shippingBagQuantityUsed, ...shipmentDto } =
      dto;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            trackingNumber: true,
            carrier: true,
            balanceDue: true,
            saleLegalRequirement: true,
            saleLegalStatus: true,
          },
        });

        if (!order) {
          throw new NotFoundException('Orden no encontrada');
        }

        if (
          this.isShipmentPastDispatch(shipmentDto.status) &&
          this.toMoney(order.balanceDue).greaterThan(0)
        ) {
          throw new ForbiddenException(
            'La orden no puede despacharse con saldo pendiente',
          );
        }

        // Buscar si existe el envío para esta orden
        let shipment = await tx.shipment.findUnique({
          where: { orderId },
        });
        const wasPastDispatch = this.isShipmentPastDispatch(shipment?.status);
        const willMovePastDispatch = this.isShipmentPastDispatch(
          shipmentDto.status,
        );
        const shouldConsumeBags = willMovePastDispatch && !wasPastDispatch;
        const receivedBagFields =
          shippingBagSupplyItemId !== undefined ||
          shippingBagQuantityUsed !== undefined;

        if (willMovePastDispatch) {
          this.assertSaleLegalClosureAllowed(order);
        }

        if (shouldConsumeBags && !shippingBagSupplyItemId?.trim()) {
          throw new BadRequestException(
            'Selecciona el tipo de bolsa de envio para confirmar el despacho',
          );
        }

        const shippingBagQuantity = shouldConsumeBags
          ? this.validateShippingBagQuantity(shippingBagQuantityUsed)
          : null;

        if (!shouldConsumeBags && receivedBagFields) {
          throw new BadRequestException(
            wasPastDispatch
              ? 'Este envio ya fue despachado; no se puede volver a descontar bolsas'
              : 'El consumo de bolsas solo se registra al confirmar el despacho',
          );
        }

        let carrierName: string | null = order.carrier;

        if (shipmentDto.providerId) {
          const provider = await tx.shippingProvider.findUnique({
            where: { id: shipmentDto.providerId },
            select: { name: true },
          });
          if (!provider) {
            throw new NotFoundException('Proveedor no encontrado');
          }
          carrierName = provider.name ?? carrierName;
        }

        if (!shipment) {
          const isDispatched = this.isDispatchedStatus(shipmentDto.status);
          // Crear envío si no existe
          shipment = await tx.shipment.create({
            data: {
              orderId,
              ...shipmentDto,
              status: shipmentDto.status || ShipmentStatus.PENDING,
              shippedAt:
                isDispatched || shipmentDto.status === ShipmentStatus.DELIVERED
                  ? new Date()
                  : null,
              deliveredAt:
                shipmentDto.status === ShipmentStatus.DELIVERED
                  ? new Date()
                  : null,
            },
          });
        } else {
          // Actualizar envío
          const data: Prisma.ShipmentUpdateInput = { ...shipmentDto };
          if (
            this.isDispatchedStatus(shipmentDto.status) &&
            !this.isDispatchedStatus(shipment.status) &&
            shipment.status !== ShipmentStatus.DELIVERED
          ) {
            data.shippedAt = new Date();
          }
          if (
            shipmentDto.status === ShipmentStatus.DELIVERED &&
            shipment.status !== ShipmentStatus.DELIVERED
          ) {
            if (!shipment.shippedAt) {
              data.shippedAt = new Date();
            }
            data.deliveredAt = new Date();
          }

          shipment = await tx.shipment.update({
            where: { orderId },
            data,
          });
        }

        // Si el estado cambia a SHIPPED, enviar notificación (placeholder)
        if (shouldConsumeBags) {
          await this.consumeShippingBagsFIFO(tx, {
            shipmentId: shipment.id,
            orderId,
            supplyItemId: shippingBagSupplyItemId as string,
            quantity: shippingBagQuantity as Decimal,
            userId,
          });
        }

        // Actualizar también el estado de la orden si corresponde
        if (this.isDispatchedStatus(shipmentDto.status)) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: OrderStatus.ENVIADA,
              trackingNumber:
                shipmentDto.trackingNumber ?? order.trackingNumber ?? undefined,
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
        } else if (shipmentDto.status === ShipmentStatus.DELIVERED) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: OrderStatus.ENTREGADA,
              trackingNumber:
                shipmentDto.trackingNumber ?? order.trackingNumber ?? undefined,
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
        } else if (shipmentDto.trackingNumber || shipmentDto.providerId) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              trackingNumber:
                shipmentDto.trackingNumber ?? order.trackingNumber ?? undefined,
              carrier: carrierName ?? undefined,
            },
          });
        }

        return {
          shipment,
          shouldNotifyDispatch: this.isDispatchedStatus(shipmentDto.status),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    if (result.shouldNotifyDispatch) {
      await this.shippingNotifier.notifyShipmentDispatched(
        orderId,
        result.shipment.trackingNumber ?? undefined,
      );
    }

    return result.shipment;
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
