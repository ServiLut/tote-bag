import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  TransactionCategory,
  TransactionType,
  WebhookProcessingStatus,
} from '../../generated/client/enums';
import { StorageService } from '../../common/storage/storage.service';
import {
  Order,
  B2BQuote,
  PurchaseBatch,
  PurchaseInvoice,
  Prisma,
} from '../../generated/client/client';
import { ShippingSyncService } from '../shipping/shipping-sync.service';
import { OrdersService } from '../orders/orders.service';
import { WompiEvent } from './interfaces/wompi-event.interface';

@Injectable()
export class PaymentsService {
  private readonly supportDocumentsBucket = 'support-documents';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private storageService: StorageService,
    private shippingSyncService: ShippingSyncService,
    private ordersService: OrdersService,
  ) {}

  private getWompiPublicKey() {
    return (
      this.configService.get<string>('WOMPI_PUBLIC_KEY') ||
      this.configService.get<string>('NEXT_PUBLIC_WOMPI_PUBLIC_KEY')
    );
  }

  private getWompiEventsSecret() {
    return this.configService.get<string>('WOMPI_EVENTS_SECRET');
  }

  private resolvePropertyPathValue(
    data: unknown,
    propertyPath: string,
  ): string {
    const value = propertyPath
      .split('.')
      .reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
          return undefined;
        }

        return (current as Record<string, unknown>)[segment];
      }, data);

    if (value === null || value === undefined) {
      return '';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private computeWompiEventChecksum(event: WompiEvent, secret: string) {
    const base = event.signature.properties
      .map((property) => this.resolvePropertyPathValue(event.data, property))
      .join('');
    const raw = `${base}${event.timestamp}${secret}`;

    return createHash('sha256').update(raw).digest('hex').toUpperCase();
  }

  private buildWebhookEventKey(event: WompiEvent) {
    const transaction = event.data.transaction;

    return [
      'wompi',
      event.event,
      transaction.id,
      transaction.reference,
      transaction.status,
    ].join(':');
  }

  private getOrderAmountInCents(totalAmount: number) {
    return Math.round(totalAmount * 100);
  }

  private assertWompiAmountMatchesOrder(
    transactionAmountInCents: number,
    order: { id: string; totalAmount: number },
  ) {
    const expectedAmountInCents = this.getOrderAmountInCents(order.totalAmount);

    if (transactionAmountInCents !== expectedAmountInCents) {
      throw new BadRequestException(
        `Wompi amount mismatch for order ${order.id}`,
      );
    }
  }

  validateWompiEventSignature(event: WompiEvent, checksumHeader?: string) {
    const eventsSecret = this.getWompiEventsSecret();

    if (!eventsSecret) {
      throw new BadRequestException('WOMPI_EVENTS_SECRET no configurado');
    }

    const expectedChecksum = (
      checksumHeader ||
      event.signature?.checksum ||
      ''
    ).toUpperCase();

    if (!expectedChecksum) {
      throw new ForbiddenException('Checksum de evento no proporcionado');
    }

    const computedChecksum = this.computeWompiEventChecksum(
      event,
      eventsSecret,
    );

    if (expectedChecksum !== computedChecksum) {
      throw new ForbiddenException('Checksum de evento invalido');
    }

    return computedChecksum;
  }

  async uploadPaymentReceipt(
    entityId: string,
    entityType: 'order' | 'b2b' | 'batch' | 'purchase-invoice',
    file: Express.Multer.File,
  ) {
    const fileName = `receipts/${entityType}/${entityId}-${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    const uploaded = await this.storageService.uploadPrivateFile(
      this.supportDocumentsBucket,
      fileName,
      file,
    );
    const signedUrl = await this.storageService.createSignedReadUrl(
      uploaded.bucket,
      uploaded.path,
    );

    let updatedEntity:
      | Order
      | B2BQuote
      | PurchaseBatch
      | PurchaseInvoice
      | undefined;

    if (entityType === 'order') {
      updatedEntity = await this.prisma.order.update({
        where: { id: entityId },
        data: { paymentReceiptUrl: uploaded.storageRef },
      });
    } else if (entityType === 'b2b') {
      updatedEntity = await this.prisma.b2BQuote.update({
        where: { id: entityId },
        data: { paymentReceiptUrl: uploaded.storageRef },
      });
    } else if (entityType === 'batch') {
      updatedEntity = await this.prisma.purchaseBatch.update({
        where: { id: entityId },
        data: { paymentReceiptUrl: uploaded.storageRef },
      });
    } else if (entityType === 'purchase-invoice') {
      updatedEntity = await this.prisma.purchaseInvoice.update({
        where: { id: entityId },
        data: { supportUrl: uploaded.storageRef },
      });
    }

    return {
      success: true,
      storageRef: uploaded.storageRef,
      signedUrl,
      url: signedUrl,
      updatedEntity,
    };
  }

  async getSupportSignedUrl(
    entityId: string,
    entityType: 'order' | 'b2b' | 'batch' | 'purchase-invoice',
  ) {
    const storageRef = await this.getEntitySupportRef(entityId, entityType);

    if (!storageRef) {
      throw new BadRequestException('La entidad no tiene soporte asociado.');
    }

    const location = this.storageService.resolveStorageLocation(
      storageRef,
      storageRef.includes('/payment-receipts/')
        ? 'payment-receipts'
        : undefined,
    );

    if (!location) {
      throw new BadRequestException(
        'El soporte no tiene una ruta privada valida.',
      );
    }

    const signedUrl = await this.storageService.createSignedReadUrl(
      location.bucket,
      location.path,
    );

    return {
      storageRef,
      signedUrl,
      expiresInSeconds: 300,
    };
  }

  private async getEntitySupportRef(
    entityId: string,
    entityType: 'order' | 'b2b' | 'batch' | 'purchase-invoice',
  ) {
    if (entityType === 'order') {
      const order = await this.prisma.order.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { paymentReceiptUrl: true },
      });
      return order?.paymentReceiptUrl ?? null;
    }

    if (entityType === 'b2b') {
      const quote = await this.prisma.b2BQuote.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { paymentReceiptUrl: true },
      });
      return quote?.paymentReceiptUrl ?? null;
    }

    if (entityType === 'batch') {
      const batch = await this.prisma.purchaseBatch.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { paymentReceiptUrl: true },
      });
      return batch?.paymentReceiptUrl ?? null;
    }

    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { supportUrl: true },
    });

    return invoice?.supportUrl ?? null;
  }

  async generateSignature(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { error: 'Orden no encontrada' };
    }

    const amountInCents = Math.round(order.totalAmount * 100);
    const currency = 'COP';
    const integritySecret = this.configService.get<string>(
      'WOMPI_INTEGRITY_SECRET',
    );

    if (!integritySecret) {
      return { error: 'WOMPI_INTEGRITY_SECRET no configurado' };
    }

    const signatureString = `${order.id}${amountInCents}${currency}${integritySecret}`;
    const signature = createHash('sha256')
      .update(signatureString)
      .digest('hex');

    return {
      reference: order.id,
      amountInCents,
      currency,
      signature,
      publicKey: this.getWompiPublicKey(),
    };
  }

  async handleWompiEvent(event: WompiEvent, checksumHeader?: string) {
    const checksum = this.validateWompiEventSignature(event, checksumHeader);
    const { event: eventType, data } = event;
    const {
      id: transactionId,
      reference,
      status,
      currency,
      amount_in_cents: amountInCents,
    } = data.transaction;
    const webhookEventKey = this.buildWebhookEventKey(event);

    if (currency !== 'COP') {
      throw new BadRequestException(
        'Wompi webhook received unsupported currency',
      );
    }

    const existingWebhook = await this.prisma.webhookEvent.findUnique({
      where: { eventId: webhookEventKey },
      select: { id: true, processed: true, status: true },
    });

    if (
      existingWebhook?.processed ||
      existingWebhook?.status === WebhookProcessingStatus.APPLIED
    ) {
      return { success: true, duplicate: true };
    }

    let newStatus: OrderStatus | null = null;

    switch (status) {
      case 'APPROVED':
        newStatus = OrderStatus.PAGADA;
        break;
      case 'VOIDED':
      case 'DECLINED':
      case 'ERROR':
        newStatus = OrderStatus.CANCELADA;
        break;
      default:
        break;
    }

    const webhookRecord = existingWebhook
      ? await this.prisma.webhookEvent.update({
          where: { id: existingWebhook.id },
          data: {
            eventType,
            payload: event as unknown as Prisma.InputJsonValue,
            signatureChecksum: checksum,
            transactionId,
            referenceId: reference,
            status: WebhookProcessingStatus.RECEIVED,
            receivedAt: new Date(),
            attempts: {
              increment: 1,
            },
            error: null,
          },
        })
      : await this.prisma.webhookEvent.create({
          data: {
            provider: 'wompi',
            eventId: webhookEventKey,
            eventType,
            payload: event as unknown as Prisma.InputJsonValue,
            signatureChecksum: checksum,
            transactionId,
            referenceId: reference,
            status: WebhookProcessingStatus.RECEIVED,
            attempts: 1,
          },
        });

    try {
      await this.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          status: WebhookProcessingStatus.VALIDATED,
          validatedAt: new Date(),
          error: null,
        },
      });

      if (!newStatus) {
        await this.prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            status: WebhookProcessingStatus.APPLIED,
            processed: true,
            processedAt: new Date(),
            appliedAt: new Date(),
          },
        });

        return { success: true, ignored: true };
      }

      await this.prisma.$transaction(async (tx) => {
        const existingOrder = await tx.order.findUnique({
          where: { id: reference },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        });

        if (!existingOrder) {
          await tx.webhookEvent.update({
            where: { id: webhookRecord.id },
            data: {
              status: WebhookProcessingStatus.FAILED,
              processed: false,
              processedAt: null,
              failedAt: new Date(),
              error: `Order not found for transaction ${transactionId}`,
            },
          });
          return;
        }

        this.assertWompiAmountMatchesOrder(amountInCents, existingOrder);

        const order =
          newStatus === OrderStatus.PAGADA
            ? await this.ordersService.confirmPendingOrderPayment(
                existingOrder.id,
                undefined,
                tx,
              )
            : existingOrder.status === newStatus
              ? existingOrder
              : await tx.order.update({
                  where: { id: reference },
                  data: {
                    status: newStatus,
                    statusHistory: {
                      create: {
                        status: newStatus,
                        oldStatus: existingOrder.status,
                        newStatus,
                        userId: null,
                      },
                    },
                  },
                });

        await this.shippingSyncService.ensureShipmentForOrder(order.id, tx);

        if (newStatus === OrderStatus.PAGADA) {
          const description = `Venta orden #${order.orderNumber} (${order.id})`;
          const existingIncome = await tx.financialTransaction.findFirst({
            where: {
              type: TransactionType.INCOME,
              category: TransactionCategory.SALE,
              description,
            },
            select: { id: true },
          });

          if (!existingIncome) {
            const adminUser = await tx.user.findFirst({
              where: { role: 'ADMIN' },
              select: { id: true },
            });

            if (adminUser?.id) {
              await tx.financialTransaction.create({
                data: {
                  type: TransactionType.INCOME,
                  category: TransactionCategory.SALE,
                  amount: order.totalAmount,
                  description,
                  userId: adminUser.id,
                },
              });
            }
          }
        }

        await tx.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            status: WebhookProcessingStatus.APPLIED,
            processed: true,
            processedAt: new Date(),
            appliedAt: new Date(),
            error: null,
          },
        });
      });

      return { success: true };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          processed: false,
          processedAt: null,
          status: WebhookProcessingStatus.FAILED,
          failedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async retryFailedWebhookEvents(limit = 10) {
    const maxAttempts = Math.max(
      1,
      this.configService.get<number>('WEBHOOK_RETRY_MAX_ATTEMPTS') ?? 5,
    );

    const failedEvents = await this.prisma.webhookEvent.findMany({
      where: {
        provider: 'wompi',
        status: WebhookProcessingStatus.FAILED,
        attempts: {
          lt: maxAttempts,
        },
      },
      orderBy: [{ failedAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        payload: true,
        signatureChecksum: true,
      },
    });

    if (failedEvents.length === 0) {
      return { retriedCount: 0, recoveredCount: 0 };
    }

    let recoveredCount = 0;

    for (const failedEvent of failedEvents) {
      const payload = failedEvent.payload as unknown as WompiEvent;

      try {
        await this.handleWompiEvent(
          payload,
          failedEvent.signatureChecksum ?? undefined,
        );
        recoveredCount += 1;
      } catch {
        // The retry lifecycle is already persisted inside handleWompiEvent.
      }
    }

    return {
      retriedCount: failedEvents.length,
      recoveredCount,
    };
  }
}
