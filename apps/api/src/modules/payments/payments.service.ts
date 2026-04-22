import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import {
  decimalToNumber,
  DecimalInput,
} from '../../common/utils/sales-tax.util';
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
import { InventoryService } from '../inventory/inventory.service';
import { WompiEvent } from './interfaces/wompi-event.interface';

export type PaymentSupportEntityType =
  | 'order'
  | 'order-payment'
  | 'b2b'
  | 'batch'
  | 'purchase-invoice';

type WompiSettlementConfig = {
  commissionPercent: number;
  fixedFeeCop: number;
  packagingCifCop: number;
  commissionVatPercent: number;
  reteFuentePercent: number;
  reteIvaPercent: number;
  reteIcaPercent: number;
};

type WompiSettlementBreakdown = {
  grossAmount: number;
  netReceivedAmount: number;
  commissionAmount: number;
  commissionVatAmount: number;
  reteFuenteAmount: number;
  reteIvaAmount: number;
  reteIcaAmount: number;
  packagingCifAmount: number;
  settlementSource: 'WEBHOOK_ESTIMATE' | 'WOMPI_REPORT';
  config: WompiSettlementConfig;
};

type ParsedWompiReportRow = {
  rowNumber: number;
  reference: string;
  transactionId: string | null;
  status: string;
  paymentMethodType: string | null;
  grossAmount: number | null;
  netReceivedAmount: number | null;
  commissionAmount: number | null;
  commissionVatAmount: number | null;
  reteFuenteAmount: number | null;
  reteIvaAmount: number | null;
  reteIcaAmount: number | null;
  raw: Record<string, string>;
};

@Injectable()
export class PaymentsService {
  private readonly supportDocumentsBucket = 'support-documents';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private storageService: StorageService,
    private shippingSyncService: ShippingSyncService,
    private ordersService: OrdersService,
    private inventoryService: InventoryService,
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

  private parseConfigNumber(key: string, fallback: number) {
    const raw = this.configService.get<string | number>(key);
    if (raw === null || raw === undefined || raw === '') {
      return fallback;
    }

    const parsed =
      typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private normalizeRateValue(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.abs(value) > 1 ? value / 100 : value;
  }

  private roundMoney(value: Decimal.Value) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private toOptionalMoneyNumber(value: Decimal.Value | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    return this.roundMoney(value).toNumber();
  }

  private isApprovedWompiStatus(status: string | null | undefined) {
    return (status ?? '').trim().toUpperCase().includes('APPROVED');
  }

  private getWompiSettlementConfig(): WompiSettlementConfig {
    return {
      commissionPercent: this.normalizeRateValue(
        this.parseConfigNumber('WOMPI_COMMISSION_PERCENT', 0),
      ),
      fixedFeeCop: this.parseConfigNumber('WOMPI_FIXED_FEE_COP', 0),
      packagingCifCop: this.parseConfigNumber('WOMPI_PACKAGING_CIF_COP', 990),
      commissionVatPercent: this.normalizeRateValue(
        this.parseConfigNumber('WOMPI_COMMISSION_VAT_PERCENT', 0),
      ),
      reteFuentePercent: this.normalizeRateValue(
        this.parseConfigNumber('WOMPI_RETEFUENTE_PERCENT', 0),
      ),
      reteIvaPercent: this.normalizeRateValue(
        this.parseConfigNumber('WOMPI_RETEIVA_PERCENT', 0),
      ),
      reteIcaPercent: this.normalizeRateValue(
        this.parseConfigNumber('WOMPI_RETEICA_PERCENT', 0),
      ),
    };
  }

  getWompiSettlementConfigSummary() {
    return this.getWompiSettlementConfig();
  }

  private buildWompiSettlementBreakdown(params: {
    grossAmount: Decimal.Value;
    settlementSource: 'WEBHOOK_ESTIMATE' | 'WOMPI_REPORT';
    netReceivedAmount?: number | null;
    commissionAmount?: number | null;
    commissionVatAmount?: number | null;
    reteFuenteAmount?: number | null;
    reteIvaAmount?: number | null;
    reteIcaAmount?: number | null;
  }): WompiSettlementBreakdown {
    const config = this.getWompiSettlementConfig();
    const grossAmount = this.roundMoney(params.grossAmount);

    const fallbackCommissionAmount = this.roundMoney(
      grossAmount.mul(config.commissionPercent).plus(config.fixedFeeCop),
    );
    const fallbackCommissionVatAmount = this.roundMoney(
      fallbackCommissionAmount.mul(config.commissionVatPercent),
    );
    const fallbackReteFuenteAmount = this.roundMoney(
      grossAmount.mul(config.reteFuentePercent),
    );
    const fallbackReteIvaAmount = this.roundMoney(
      grossAmount.mul(config.reteIvaPercent),
    );
    const fallbackReteIcaAmount = this.roundMoney(
      grossAmount.mul(config.reteIcaPercent),
    );
    const packagingCifAmount = this.roundMoney(config.packagingCifCop);

    const commissionAmount = this.roundMoney(
      params.commissionAmount ?? fallbackCommissionAmount,
    );
    const commissionVatAmount = this.roundMoney(
      params.commissionVatAmount ?? fallbackCommissionVatAmount,
    );
    const reteFuenteAmount = this.roundMoney(
      params.reteFuenteAmount ?? fallbackReteFuenteAmount,
    );
    const reteIvaAmount = this.roundMoney(
      params.reteIvaAmount ?? fallbackReteIvaAmount,
    );
    const reteIcaAmount = this.roundMoney(
      params.reteIcaAmount ?? fallbackReteIcaAmount,
    );
    const netReceivedAmount = this.roundMoney(
      params.netReceivedAmount ??
        grossAmount
          .minus(commissionAmount)
          .minus(commissionVatAmount)
          .minus(reteFuenteAmount)
          .minus(reteIvaAmount)
          .minus(reteIcaAmount)
          .minus(packagingCifAmount),
    );

    return {
      grossAmount: grossAmount.toNumber(),
      netReceivedAmount: netReceivedAmount.toNumber(),
      commissionAmount: commissionAmount.toNumber(),
      commissionVatAmount: commissionVatAmount.toNumber(),
      reteFuenteAmount: reteFuenteAmount.toNumber(),
      reteIvaAmount: reteIvaAmount.toNumber(),
      reteIcaAmount: reteIcaAmount.toNumber(),
      packagingCifAmount: packagingCifAmount.toNumber(),
      settlementSource: params.settlementSource,
      config,
    };
  }

  private normalizeHeaderName(header: string) {
    return header
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private parseDelimitedLine(line: string, delimiter: string) {
    const cells: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"') {
        if (insideQuotes && next === '"') {
          current += '"';
          index += 1;
          continue;
        }

        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === delimiter && !insideQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells.map((cell) => cell.replace(/^"|"$/g, '').trim());
  }

  private parseFlexibleMoney(raw: string | null | undefined) {
    if (!raw) {
      return null;
    }

    const normalized = raw.trim();

    if (!normalized) {
      return null;
    }

    const digitsOnly = normalized.replace(/[^\d,.-]/g, '');
    if (!digitsOnly) {
      return null;
    }

    const hasComma = digitsOnly.includes(',');
    const hasDot = digitsOnly.includes('.');
    const lastCommaIndex = digitsOnly.lastIndexOf(',');
    const lastDotIndex = digitsOnly.lastIndexOf('.');
    let canonical = digitsOnly;

    if (hasComma && hasDot) {
      canonical =
        lastCommaIndex > lastDotIndex
          ? digitsOnly.replace(/\./g, '').replace(',', '.')
          : digitsOnly.replace(/,/g, '');
    } else if (hasComma) {
      canonical =
        digitsOnly.length - lastCommaIndex - 1 <= 2
          ? digitsOnly.replace(/\./g, '').replace(',', '.')
          : digitsOnly.replace(/,/g, '');
    } else if (hasDot && digitsOnly.length - lastDotIndex - 1 > 2) {
      canonical = digitsOnly.replace(/\./g, '');
    }

    const parsed = Number(canonical);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseWompiReport(file: Express.Multer.File) {
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'txt'].includes(extension)) {
      throw new UnsupportedMediaTypeException(
        'El reporte Wompi debe cargarse en formato CSV o TXT delimitado',
      );
    }

    const rawText = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'El archivo de conciliacion Wompi no contiene filas suficientes',
      );
    }

    const headerLine = lines[0];
    const delimiterCandidates = [',', ';', '\t'];
    const delimiter = delimiterCandidates.sort(
      (left, right) =>
        headerLine.split(right).length - headerLine.split(left).length,
    )[0];
    const normalizedHeaders = this.parseDelimitedLine(
      headerLine,
      delimiter,
    ).map((header) => this.normalizeHeaderName(header));

    const aliases = {
      reference: ['reference', 'referencia', 'referenciapago', 'orderid'],
      transactionId: ['transactionid', 'idtransaccion', 'id', 'transaccionid'],
      status: ['status', 'estado'],
      paymentMethodType: ['paymentmethodtype', 'metododepago', 'metodopago'],
      grossAmountInCents: [
        'amountincents',
        'grossamountincents',
        'montoencentavos',
      ],
      grossAmount: [
        'grossamount',
        'montobruto',
        'monto',
        'valorbruto',
        'amount',
      ],
      netReceivedAmount: [
        'netreceivedamount',
        'montoneto',
        'neto',
        'valorconsignado',
        'montoaconsignar',
      ],
      commissionAmount: ['commissionamount', 'comision', 'fee', 'cargo'],
      commissionVatAmount: ['commissionvatamount', 'ivacomision', 'feevat'],
      reteFuenteAmount: ['retefuenteamount', 'retefuente'],
      reteIvaAmount: ['reteivaamount', 'reteiva'],
      reteIcaAmount: ['reteicaamount', 'reteica'],
    } satisfies Record<string, string[]>;

    const getValue = (row: string[], fieldAliases: string[]) => {
      for (const alias of fieldAliases) {
        const index = normalizedHeaders.findIndex((header) => header === alias);
        if (index >= 0 && row[index] !== undefined) {
          return row[index];
        }
      }

      return '';
    };

    return lines.slice(1).map<ParsedWompiReportRow>((line, index) => {
      const row = this.parseDelimitedLine(line, delimiter);
      const rawRecord = Object.fromEntries(
        normalizedHeaders.map((header, headerIndex) => [
          header,
          row[headerIndex] ?? '',
        ]),
      );

      const grossRaw = getValue(row, aliases.grossAmount);
      const grossAmountInCents = this.parseFlexibleMoney(
        getValue(row, aliases.grossAmountInCents),
      );
      const grossAmount =
        grossAmountInCents !== null
          ? this.roundMoney(new Decimal(grossAmountInCents).div(100)).toNumber()
          : this.parseFlexibleMoney(grossRaw);

      return {
        rowNumber: index + 2,
        reference: getValue(row, aliases.reference).trim(),
        transactionId: getValue(row, aliases.transactionId).trim() || null,
        status: getValue(row, aliases.status).trim().toUpperCase() || 'UNKNOWN',
        paymentMethodType:
          getValue(row, aliases.paymentMethodType).trim() || null,
        grossAmount,
        netReceivedAmount: this.parseFlexibleMoney(
          getValue(row, aliases.netReceivedAmount),
        ),
        commissionAmount: this.parseFlexibleMoney(
          getValue(row, aliases.commissionAmount),
        ),
        commissionVatAmount: this.parseFlexibleMoney(
          getValue(row, aliases.commissionVatAmount),
        ),
        reteFuenteAmount: this.parseFlexibleMoney(
          getValue(row, aliases.reteFuenteAmount),
        ),
        reteIvaAmount: this.parseFlexibleMoney(
          getValue(row, aliases.reteIvaAmount),
        ),
        reteIcaAmount: this.parseFlexibleMoney(
          getValue(row, aliases.reteIcaAmount),
        ),
        raw: rawRecord,
      };
    });
  }

  private buildWompiSettlementMetadata(params: {
    breakdown: WompiSettlementBreakdown;
    transactionId?: string | null;
    externalStatus?: string | null;
    paymentMethodType?: string | null;
    checksum?: string | null;
    eventType?: string | null;
    rawReportRow?: Record<string, string> | null;
  }): Prisma.InputJsonValue {
    const metadata: Record<string, unknown> = {
      provider: 'wompi',
      source: params.breakdown.settlementSource,
      configuration: params.breakdown.config,
    };

    if (params.transactionId) {
      metadata.transactionId = params.transactionId;
    }

    if (params.externalStatus) {
      metadata.externalStatus = params.externalStatus;
    }

    if (params.paymentMethodType) {
      metadata.paymentMethodType = params.paymentMethodType;
    }

    if (params.checksum) {
      metadata.checksum = params.checksum;
    }

    if (params.eventType) {
      metadata.eventType = params.eventType;
    }

    if (params.rawReportRow) {
      metadata.reportRow = params.rawReportRow;
    }

    return metadata as Prisma.InputJsonValue;
  }

  private buildWompiOrderPaymentUpdate(params: {
    breakdown: WompiSettlementBreakdown;
    transactionId?: string | null;
    externalStatus?: string | null;
    paymentMethodType?: string | null;
    reconciledAt?: Date | null;
    checksum?: string | null;
    eventType?: string | null;
    rawReportRow?: Record<string, string> | null;
  }): Prisma.OrderPaymentUpdateInput {
    return {
      provider: 'wompi',
      externalTransactionId: params.transactionId ?? null,
      externalStatus: params.externalStatus ?? null,
      paymentMethodType: params.paymentMethodType ?? null,
      grossAmount: params.breakdown.grossAmount,
      netReceivedAmount: params.breakdown.netReceivedAmount,
      commissionAmount: params.breakdown.commissionAmount,
      commissionVatAmount: params.breakdown.commissionVatAmount,
      reteFuenteAmount: params.breakdown.reteFuenteAmount,
      reteIvaAmount: params.breakdown.reteIvaAmount,
      reteIcaAmount: params.breakdown.reteIcaAmount,
      packagingCifAmount: params.breakdown.packagingCifAmount,
      settlementSource: params.breakdown.settlementSource,
      settlementMetadata: this.buildWompiSettlementMetadata({
        breakdown: params.breakdown,
        transactionId: params.transactionId,
        externalStatus: params.externalStatus,
        paymentMethodType: params.paymentMethodType,
        checksum: params.checksum,
        eventType: params.eventType,
        rawReportRow: params.rawReportRow,
      }),
      reconciledAt: params.reconciledAt ?? null,
    };
  }

  private async findOrderForWompiReference(
    tx: Prisma.TransactionClient,
    reference: string,
  ) {
    const trimmedReference = reference.trim();

    if (!trimmedReference) {
      return null;
    }

    const orderById = await tx.order.findFirst({
      where: { id: trimmedReference, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
      },
    });

    if (orderById) {
      return orderById;
    }

    if (/^\d+$/.test(trimmedReference)) {
      return tx.order.findFirst({
        where: {
          orderNumber: Number(trimmedReference),
          deletedAt: null,
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
        },
      });
    }

    return null;
  }

  private async findLatestWompiOrderPayment(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      transactionId?: string | null;
    },
  ) {
    if (params.transactionId) {
      const paymentByTransaction = await tx.orderPayment.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { externalTransactionId: params.transactionId },
            { proofUrl: { contains: params.transactionId } },
          ],
        },
        select: {
          id: true,
          amount: true,
          grossAmount: true,
          netReceivedAmount: true,
          commissionAmount: true,
          commissionVatAmount: true,
          reteFuenteAmount: true,
          reteIvaAmount: true,
          reteIcaAmount: true,
          paymentMethodType: true,
        },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      });

      if (paymentByTransaction) {
        return paymentByTransaction;
      }
    }

    const wompiPayment = await tx.orderPayment.findFirst({
      where: {
        orderId: params.orderId,
        deletedAt: null,
        OR: [
          { provider: 'wompi' },
          { proofUrl: { contains: 'wompi.com/transactions' } },
        ],
      },
      select: {
        id: true,
        amount: true,
        grossAmount: true,
        netReceivedAmount: true,
        commissionAmount: true,
        commissionVatAmount: true,
        reteFuenteAmount: true,
        reteIvaAmount: true,
        reteIcaAmount: true,
        paymentMethodType: true,
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });

    if (wompiPayment) {
      return wompiPayment;
    }

    return tx.orderPayment.findFirst({
      where: {
        orderId: params.orderId,
        deletedAt: null,
      },
      select: {
        id: true,
        amount: true,
        grossAmount: true,
        netReceivedAmount: true,
        commissionAmount: true,
        commissionVatAmount: true,
        reteFuenteAmount: true,
        reteIvaAmount: true,
        reteIcaAmount: true,
        paymentMethodType: true,
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });
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

  private getOrderAmountInCents(totalAmount: DecimalInput) {
    return Math.round(decimalToNumber(totalAmount) * 100);
  }

  private buildWompiPaymentProofUrl(transactionId: string) {
    return `https://wompi.com/transactions/${encodeURIComponent(transactionId)}`;
  }

  private assertWompiAmountMatchesOrder(
    transactionAmountInCents: number,
    order: { id: string; totalAmount: DecimalInput },
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
    entityType: PaymentSupportEntityType,
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
    } else if (entityType === 'order-payment') {
      const order = await this.prisma.order.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { id: true },
      });

      if (!order) {
        throw new BadRequestException('Orden no encontrada');
      }
    } else if (entityType === 'b2b') {
      updatedEntity = await this.prisma.b2BQuote.update({
        where: { id: entityId },
        data: { paymentReceiptUrl: uploaded.storageRef },
      });
    } else if (entityType === 'batch') {
      updatedEntity = await this.prisma.purchaseBatch.update({
        where: { id: entityId },
        data: {
          supportUrl: uploaded.storageRef,
          paymentReceiptUrl: uploaded.storageRef,
        },
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
    entityType: PaymentSupportEntityType,
  ) {
    const storageRef = await this.getEntitySupportRef(entityId, entityType);

    if (!storageRef) {
      throw new BadRequestException('La entidad no tiene soporte asociado.');
    }

    if (/^https?:\/\//i.test(storageRef)) {
      return {
        storageRef,
        signedUrl: storageRef,
        expiresInSeconds: null,
      };
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
    entityType: PaymentSupportEntityType,
  ) {
    if (entityType === 'order') {
      const order = await this.prisma.order.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { paymentReceiptUrl: true },
      });
      return order?.paymentReceiptUrl ?? null;
    }

    if (entityType === 'order-payment') {
      const payment = await this.prisma.orderPayment.findFirst({
        where: { id: entityId, deletedAt: null },
        select: { proofUrl: true },
      });
      return payment?.proofUrl ?? null;
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
        select: { supportUrl: true, paymentReceiptUrl: true },
      });
      return batch?.supportUrl ?? batch?.paymentReceiptUrl ?? null;
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

    const amountInCents = this.getOrderAmountInCents(order.totalAmount);
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
    const settlementBreakdown = this.isApprovedWompiStatus(status)
      ? this.buildWompiSettlementBreakdown({
          grossAmount: new Decimal(amountInCents).div(100),
          settlementSource: 'WEBHOOK_ESTIMATE',
        })
      : null;

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
            items: {
              select: {
                id: true,
                variantId: true,
                quantity: true,
                pricingJson: true,
              },
            },
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
                this.buildWompiPaymentProofUrl(transactionId),
              )
            : existingOrder.status === newStatus
              ? existingOrder
              : await (async () => {
                  if (newStatus === OrderStatus.CANCELADA) {
                    for (const item of existingOrder.items) {
                      if (
                        item.variantId &&
                        item.pricingJson &&
                        typeof item.pricingJson === 'object' &&
                        !Array.isArray(item.pricingJson) &&
                        'inventoryCommitment' in item.pricingJson
                      ) {
                        await this.inventoryService.releaseCommittedStock(
                          item.variantId,
                          item.quantity,
                          undefined,
                          existingOrder.id,
                          tx,
                        );

                        const pricingJsonRest = {
                          ...(item.pricingJson as Record<string, unknown>),
                        };
                        delete pricingJsonRest.inventoryCommitment;

                        await tx.orderItem.update({
                          where: { id: item.id },
                          data: {
                            pricingJson: Object.keys(pricingJsonRest).length
                              ? (pricingJsonRest as Prisma.InputJsonValue)
                              : (null as unknown as Prisma.InputJsonValue),
                          },
                        });
                      }
                    }
                  }

                  return tx.order.update({
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
                })();

        await this.shippingSyncService.ensureShipmentForOrder(order.id, tx);

        if (newStatus === OrderStatus.PAGADA) {
          const paymentRecord = await this.findLatestWompiOrderPayment(tx, {
            orderId: order.id,
            transactionId,
          });

          if (!paymentRecord || !settlementBreakdown) {
            throw new BadRequestException(
              `Payment record not found for approved Wompi order ${order.id}`,
            );
          }

          await tx.orderPayment.update({
            where: { id: paymentRecord.id },
            data: this.buildWompiOrderPaymentUpdate({
              breakdown: settlementBreakdown,
              transactionId,
              externalStatus: status,
              paymentMethodType: data.transaction.payment_method_type ?? null,
              checksum,
              eventType,
            }),
          });

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

  async reconcileWompiReport(file: Express.Multer.File) {
    const rows = this.parseWompiReport(file);
    const reconciledAt = new Date();
    const result = {
      fileName: file.originalname,
      processedRows: rows.length,
      reconciledPayments: 0,
      unmatchedOrders: [] as Array<{
        rowNumber: number;
        reference: string;
        transactionId: string | null;
      }>,
      unmatchedPayments: [] as Array<{
        rowNumber: number;
        orderId: string;
        reference: string;
        transactionId: string | null;
      }>,
      statusMismatches: [] as Array<{
        rowNumber: number;
        orderId: string;
        orderStatus: OrderStatus;
        reportStatus: string;
      }>,
    };

    for (const row of rows) {
      const reconciliation = await this.prisma.$transaction(async (tx) => {
        const order = await this.findOrderForWompiReference(tx, row.reference);

        if (!order) {
          return {
            kind: 'unmatched-order' as const,
            rowNumber: row.rowNumber,
            reference: row.reference,
            transactionId: row.transactionId,
          };
        }

        const payment = await this.findLatestWompiOrderPayment(tx, {
          orderId: order.id,
          transactionId: row.transactionId,
        });

        if (!payment) {
          return {
            kind: 'unmatched-payment' as const,
            rowNumber: row.rowNumber,
            orderId: order.id,
            reference: row.reference,
            transactionId: row.transactionId,
          };
        }

        const fallbackGrossAmount =
          row.grossAmount ??
          this.toOptionalMoneyNumber(payment.grossAmount) ??
          this.toOptionalMoneyNumber(payment.amount) ??
          order.totalAmount;

        const breakdown = this.buildWompiSettlementBreakdown({
          grossAmount: fallbackGrossAmount,
          settlementSource: 'WOMPI_REPORT',
          netReceivedAmount:
            row.netReceivedAmount ??
            this.toOptionalMoneyNumber(payment.netReceivedAmount),
          commissionAmount:
            row.commissionAmount ??
            this.toOptionalMoneyNumber(payment.commissionAmount),
          commissionVatAmount:
            row.commissionVatAmount ??
            this.toOptionalMoneyNumber(payment.commissionVatAmount),
          reteFuenteAmount:
            row.reteFuenteAmount ??
            this.toOptionalMoneyNumber(payment.reteFuenteAmount),
          reteIvaAmount:
            row.reteIvaAmount ??
            this.toOptionalMoneyNumber(payment.reteIvaAmount),
          reteIcaAmount:
            row.reteIcaAmount ??
            this.toOptionalMoneyNumber(payment.reteIcaAmount),
        });

        await tx.orderPayment.update({
          where: { id: payment.id },
          data: this.buildWompiOrderPaymentUpdate({
            breakdown,
            transactionId: row.transactionId,
            externalStatus: row.status,
            paymentMethodType:
              row.paymentMethodType ?? payment.paymentMethodType ?? null,
            reconciledAt,
            rawReportRow: row.raw,
          }),
        });

        return {
          kind: 'reconciled' as const,
          rowNumber: row.rowNumber,
          orderId: order.id,
          orderStatus: order.status,
          reportStatus: row.status,
        };
      });

      if (reconciliation.kind === 'reconciled') {
        result.reconciledPayments += 1;

        if (
          this.isApprovedWompiStatus(reconciliation.reportStatus) &&
          reconciliation.orderStatus !== OrderStatus.PAGADA
        ) {
          result.statusMismatches.push({
            rowNumber: reconciliation.rowNumber,
            orderId: reconciliation.orderId,
            orderStatus: reconciliation.orderStatus,
            reportStatus: reconciliation.reportStatus,
          });
        }

        continue;
      }

      if (reconciliation.kind === 'unmatched-order') {
        result.unmatchedOrders.push(reconciliation);
        continue;
      }

      result.unmatchedPayments.push(reconciliation);
    }

    return {
      ...result,
      settlementConfig: this.getWompiSettlementConfigSummary(),
    };
  }
}
