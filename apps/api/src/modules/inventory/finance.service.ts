import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import {
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from '../../generated/client/client';
import {
  TransactionType,
  TransactionCategory,
  PurchaseDocumentType,
} from '../../generated/client/enums';
import {
  calculateGrossTaxBreakdown,
  decimalToNumber,
  DecimalInput,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';
import { BreakEvenSimulationDto } from './dto/break-even-simulation.dto';
import { UpdateFixedExpensesConfigDto } from './dto/update-fixed-expenses-config.dto';

type FinancialReportQuery = {
  startDate?: string;
  endDate?: string;
  month?: string;
  year?: string;
};

type FinancialReportOrder = {
  id: string;
  orderNumber: number;
  customerEmail: string | null;
  totalAmount: Decimal;
  netAmount: DecimalInput;
  taxTotal: DecimalInput;
  createdAt: Date;
  status: OrderStatus;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  statusHistory: Array<{
    status: OrderStatus;
    createdAt: Date;
  }>;
  shipment: {
    status: ShipmentStatus;
    updatedAt: Date;
  } | null;
};

type FinancialGatewayConfig = {
  commissionPercent: Decimal;
  fixedFeeCop: Decimal;
  packagingCifCop: Decimal;
  commissionVatPercent: Decimal;
  reteFuentePercent: Decimal;
  reteIvaPercent: Decimal;
  reteIcaPercent: Decimal;
};

type InventoryConsumptionReductionSnapshot = {
  purchaseBatchLineId: string | null;
  batchId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
  documentType: PurchaseDocumentType;
};

type InventoryConsumptionSnapshot = {
  totalCOGS: number;
  reductions: InventoryConsumptionReductionSnapshot[];
};

type OrderProfitabilityOrderRecord = {
  id: string;
  orderNumber: number;
  customerEmail: string;
  createdAt: Date;
  status: OrderStatus;
  totalAmount: Decimal;
  netAmount: DecimalInput;
  taxTotal: DecimalInput;
  amountPaid: DecimalInput;
  balanceDue: DecimalInput;
  items: Array<{
    id: string;
    sku: string;
    quantity: number;
    pricingJson: Prisma.JsonValue | null;
    variant: {
      costPrice: Decimal | null;
      totalCost: Decimal | null;
      taxRate: DecimalInput;
    } | null;
  }>;
  payments: Array<{
    id: string;
    amount: DecimalInput;
    paymentDate: Date;
    provider: string | null;
    paymentMethodType: string | null;
    grossAmount: DecimalInput | null;
    netReceivedAmount: DecimalInput | null;
    commissionAmount: DecimalInput | null;
    commissionVatAmount: DecimalInput | null;
    reteFuenteAmount: DecimalInput | null;
    reteIvaAmount: DecimalInput | null;
    reteIcaAmount: DecimalInput | null;
    packagingCifAmount: DecimalInput | null;
    settlementSource: string | null;
  }>;
};

type OrderProfitabilityRow = {
  id: string;
  orderNumber: number;
  customerEmail: string;
  createdAt: Date;
  status: OrderStatus;
  paymentProvider: string;
  paymentMethodType: string;
  ingresoBruto: number;
  ventaNetaSinIva: number;
  iva: number;
  costoProducto: number;
  comisionWompi: number;
  ivaComision: number;
  costoLogisticoCif: number;
  utilidadBruta: number;
  utilidadOperativa: number;
  utilidadNeta: number;
  utilidadNetaReal: number;
  netoRecibidoBanco: number;
  retencionesActivas: number;
  reteFuente: number;
  reteIva: number;
  reteIca: number;
  brutoVsNetoDelta: number;
  margenSobreNetoPasarela: number | null;
  alertaMargenBajo: boolean;
  isFullyPaid: boolean;
};

type OrderProfitabilitySummary = {
  orderCount: number;
  grossRevenue: number;
  netSalesWithoutVat: number;
  vatLiability: number;
  productCost: number;
  commissionAmount: number;
  commissionVatAmount: number;
  logisticsCifAmount: number;
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  realNetProfit: number;
  netReceivedBank: number;
  retentionAssetTotal: number;
  reteFuenteTotal: number;
  reteIvaTotal: number;
  reteIcaTotal: number;
  grossVsNetDelta: number;
  marginOnGatewayNet: number | null;
  marginTarget: number;
  belowTargetCount: number;
};

type GatewayMarginGridResult = {
  config: {
    commissionPercent: number;
    fixedFeeCop: number;
    packagingCifCop: number;
    commissionVatPercent: number;
    reteFuentePercent: number;
    reteIvaPercent: number;
    reteIcaPercent: number;
  };
  current: {
    ingresoBruto: number;
    ventaNetaSinIva: number;
    iva: number;
    costoProducto: number;
    comisionWompi: number;
    ivaComision: number;
    costoLogisticoCif: number;
    netoRecibidoBanco: number;
    retencionesActivas: number;
    utilidadBruta: number;
    utilidadOperativa: number;
    utilidadNeta: number;
    margenSobreNetoPasarela: number | null;
    alertaMargenBajo: boolean;
  };
  targets: Array<{
    targetMargin: number;
    requiredGrossAmount: number | null;
    requiredNetReceivedAmount: number | null;
    expectedNetProfit: number | null;
    reachable: boolean;
  }>;
};

type FixedExpenseConfigItem = {
  id: string;
  label: string;
  amount: number;
};

type FixedExpenseConfigResponse = {
  key: string;
  currency: 'COP';
  period: 'monthly';
  monthlyTotal: number;
  items: FixedExpenseConfigItem[];
  isConfigured: boolean;
  updatedAt: Date | null;
};

type FixedExpenseConfigRecord = {
  currency: 'COP';
  period: 'monthly';
  items: FixedExpenseConfigItem[];
};

type AppSettingRow = {
  value: Prisma.JsonValue;
  updated_at: Date;
};

type BreakEvenThermometerReport = {
  period: {
    label: string;
    startDate: Date;
    endDate: Date;
  };
  fixedExpensesConfig: FixedExpenseConfigResponse;
  orderCount: number;
  accumulatedNetProfit: number;
  targetFixedExpenses: number;
  progressRatio: number;
  progressPercentage: number;
  progressPercentageCapped: number;
  remainingToBreakEven: number;
  surplusOverBreakEven: number;
  status: 'UNCONFIGURED' | 'IN_PROGRESS' | 'BREAK_EVEN_REACHED';
};

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly revenueOrderStatuses: OrderStatus[] = [
    OrderStatus.PAGADA,
    OrderStatus.EN_PRODUCCION,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.READY_FOR_DISPATCH,
    OrderStatus.ENVIADA,
    OrderStatus.ENTREGADA,
  ];

  private readonly gatewayMarginTarget = new Decimal('0.60');
  private readonly monthlyFixedExpensesSettingKey =
    'finance.monthly_fixed_expenses';
  private readonly defaultFixedExpenseItems: FixedExpenseConfigItem[] = [
    { id: 'payroll', label: 'Nomina', amount: 0 },
    { id: 'rent', label: 'Arriendo', amount: 0 },
    { id: 'services', label: 'Servicios', amount: 0 },
  ];

  private parseFinancialConfigNumber(key: string, fallback: number) {
    const raw = process.env[key];
    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }

    const parsed = Number(String(raw).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private normalizeRateDecimal(value: number) {
    if (!Number.isFinite(value)) {
      return new Decimal(0);
    }

    return new Decimal(Math.abs(value) > 1 ? value / 100 : value);
  }

  private getFinancialGatewayConfig(): FinancialGatewayConfig {
    return {
      commissionPercent: this.normalizeRateDecimal(
        this.parseFinancialConfigNumber('WOMPI_COMMISSION_PERCENT', 0),
      ),
      fixedFeeCop: roundMoney(
        this.parseFinancialConfigNumber('WOMPI_FIXED_FEE_COP', 0),
      ),
      packagingCifCop: roundMoney(
        this.parseFinancialConfigNumber('WOMPI_PACKAGING_CIF_COP', 990),
      ),
      commissionVatPercent: this.normalizeRateDecimal(
        this.parseFinancialConfigNumber('WOMPI_COMMISSION_VAT_PERCENT', 0),
      ),
      reteFuentePercent: this.normalizeRateDecimal(
        this.parseFinancialConfigNumber('WOMPI_RETEFUENTE_PERCENT', 0),
      ),
      reteIvaPercent: this.normalizeRateDecimal(
        this.parseFinancialConfigNumber('WOMPI_RETEIVA_PERCENT', 0),
      ),
      reteIcaPercent: this.normalizeRateDecimal(
        this.parseFinancialConfigNumber('WOMPI_RETEICA_PERCENT', 0),
      ),
    };
  }

  private sumMoney(
    collection: ReadonlyArray<Record<string, unknown>>,
    selector: (
      item: Record<string, unknown>,
    ) => DecimalInput | null | undefined,
  ) {
    return collection.reduce(
      (sum, item) => sum.plus(toDecimal(selector(item) ?? 0)),
      new Decimal(0),
    );
  }

  private isWompiProvider(provider: string | null | undefined) {
    return (provider ?? '').trim().toLowerCase() === 'wompi';
  }

  private extractInventoryConsumptionSnapshot(
    pricingJson: Prisma.JsonValue | null,
  ): InventoryConsumptionSnapshot | null {
    if (
      !pricingJson ||
      typeof pricingJson !== 'object' ||
      Array.isArray(pricingJson)
    ) {
      return null;
    }

    const inventoryConsumption = (pricingJson as Record<string, unknown>)
      .inventoryConsumption;

    if (
      !inventoryConsumption ||
      typeof inventoryConsumption !== 'object' ||
      Array.isArray(inventoryConsumption)
    ) {
      return null;
    }

    const rawConsumption = inventoryConsumption as Record<string, unknown>;
    const reductions = rawConsumption.reductions;

    if (!Array.isArray(reductions)) {
      return null;
    }

    const parsedReductions = reductions.flatMap((reduction) => {
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
        typeof candidate.unitCost !== 'number' ||
        (candidate.documentType !== PurchaseDocumentType.INVOICE &&
          candidate.documentType !== PurchaseDocumentType.DELIVERY_NOTE)
      ) {
        return [];
      }

      return [
        {
          purchaseBatchLineId:
            typeof candidate.purchaseBatchLineId === 'string'
              ? candidate.purchaseBatchLineId
              : null,
          batchId: candidate.batchId,
          supplierId: candidate.supplierId,
          quantity: candidate.quantity,
          unitCost: candidate.unitCost,
          documentType: candidate.documentType,
        },
      ];
    });

    if (parsedReductions.length === 0) {
      return null;
    }

    return {
      totalCOGS:
        typeof rawConsumption.totalCOGS === 'number'
          ? rawConsumption.totalCOGS
          : 0,
      reductions: parsedReductions,
    };
  }

  private buildPaymentSettlementBreakdown(params: {
    amount: DecimalInput;
    provider?: string | null;
    grossAmount?: DecimalInput | null;
    netReceivedAmount?: DecimalInput | null;
    commissionAmount?: DecimalInput | null;
    commissionVatAmount?: DecimalInput | null;
    reteFuenteAmount?: DecimalInput | null;
    reteIvaAmount?: DecimalInput | null;
    reteIcaAmount?: DecimalInput | null;
    packagingCifAmount?: DecimalInput | null;
  }) {
    const config = this.getFinancialGatewayConfig();
    const provider = params.provider ?? null;
    const grossAmount = roundMoney(params.grossAmount ?? params.amount);

    if (!this.isWompiProvider(provider)) {
      const packagingCifAmount = roundMoney(params.packagingCifAmount ?? 0);
      const netReceivedAmount = roundMoney(
        params.netReceivedAmount ?? params.amount,
      );

      return {
        grossAmount,
        netReceivedAmount,
        commissionAmount: roundMoney(params.commissionAmount ?? 0),
        commissionVatAmount: roundMoney(params.commissionVatAmount ?? 0),
        reteFuenteAmount: roundMoney(params.reteFuenteAmount ?? 0),
        reteIvaAmount: roundMoney(params.reteIvaAmount ?? 0),
        reteIcaAmount: roundMoney(params.reteIcaAmount ?? 0),
        packagingCifAmount,
      };
    }

    const commissionAmount = roundMoney(
      params.commissionAmount ??
        grossAmount.mul(config.commissionPercent).plus(config.fixedFeeCop),
    );
    const commissionVatAmount = roundMoney(
      params.commissionVatAmount ??
        commissionAmount.mul(config.commissionVatPercent),
    );
    const reteFuenteAmount = roundMoney(
      params.reteFuenteAmount ?? grossAmount.mul(config.reteFuentePercent),
    );
    const reteIvaAmount = roundMoney(
      params.reteIvaAmount ?? grossAmount.mul(config.reteIvaPercent),
    );
    const reteIcaAmount = roundMoney(
      params.reteIcaAmount ?? grossAmount.mul(config.reteIcaPercent),
    );
    const packagingCifAmount = roundMoney(
      params.packagingCifAmount ?? config.packagingCifCop,
    );
    const netReceivedAmount = roundMoney(
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
      grossAmount,
      netReceivedAmount,
      commissionAmount,
      commissionVatAmount,
      reteFuenteAmount,
      reteIvaAmount,
      reteIcaAmount,
      packagingCifAmount,
    };
  }

  private buildProfitabilityMetrics(params: {
    grossAmount: DecimalInput;
    netSalesWithoutVat?: DecimalInput;
    vatAmount?: DecimalInput;
    productCost: DecimalInput;
    commissionAmount: DecimalInput;
    commissionVatAmount: DecimalInput;
    logisticsCifAmount: DecimalInput;
    netReceivedAmount: DecimalInput;
    reteFuenteAmount: DecimalInput;
    reteIvaAmount: DecimalInput;
    reteIcaAmount: DecimalInput;
    marginTarget?: DecimalInput;
  }) {
    const grossAmount = roundMoney(params.grossAmount);
    const netSalesWithoutVat = roundMoney(
      params.netSalesWithoutVat ??
        toDecimal(grossAmount).minus(toDecimal(params.vatAmount ?? 0)),
    );
    const vatAmount = roundMoney(
      params.vatAmount ?? new Decimal(grossAmount).minus(netSalesWithoutVat),
    );
    const productCost = roundMoney(params.productCost);
    const commissionAmount = roundMoney(params.commissionAmount);
    const commissionVatAmount = roundMoney(params.commissionVatAmount);
    const logisticsCifAmount = roundMoney(params.logisticsCifAmount);
    const netReceivedAmount = roundMoney(params.netReceivedAmount);
    const reteFuenteAmount = roundMoney(params.reteFuenteAmount);
    const reteIvaAmount = roundMoney(params.reteIvaAmount);
    const reteIcaAmount = roundMoney(params.reteIcaAmount);
    const retentionAsset = roundMoney(
      reteFuenteAmount.plus(reteIvaAmount).plus(reteIcaAmount),
    );
    const grossProfit = roundMoney(netSalesWithoutVat.minus(productCost));
    const operatingProfit = roundMoney(
      grossProfit
        .minus(commissionAmount)
        .minus(commissionVatAmount)
        .minus(logisticsCifAmount),
    );
    const realNetProfit = roundMoney(
      netReceivedAmount
        .plus(retentionAsset)
        .minus(vatAmount)
        .minus(productCost),
    );
    const marginOnGatewayNet = netReceivedAmount.greaterThan(0)
      ? realNetProfit.div(netReceivedAmount)
      : null;
    const effectiveMarginTarget = toDecimal(
      params.marginTarget ?? this.gatewayMarginTarget,
    );

    return {
      grossAmount,
      netSalesWithoutVat,
      vatAmount,
      productCost,
      commissionAmount,
      commissionVatAmount,
      logisticsCifAmount,
      netReceivedAmount,
      reteFuenteAmount,
      reteIvaAmount,
      reteIcaAmount,
      retentionAsset,
      grossProfit,
      operatingProfit,
      netProfit: operatingProfit,
      realNetProfit,
      grossVsNetDelta: roundMoney(grossAmount.minus(netReceivedAmount)),
      marginOnGatewayNet,
      isBelowTarget:
        marginOnGatewayNet !== null &&
        marginOnGatewayNet.lessThan(effectiveMarginTarget),
    };
  }

  private buildOrderProfitabilityRow(
    order: OrderProfitabilityOrderRecord,
  ): OrderProfitabilityRow {
    const settlement = order.payments.reduce(
      (accumulator, payment) => {
        const current = this.buildPaymentSettlementBreakdown({
          amount: payment.amount ?? 0,
          provider: payment.provider,
          grossAmount: payment.grossAmount,
          netReceivedAmount: payment.netReceivedAmount,
          commissionAmount: payment.commissionAmount,
          commissionVatAmount: payment.commissionVatAmount,
          reteFuenteAmount: payment.reteFuenteAmount,
          reteIvaAmount: payment.reteIvaAmount,
          reteIcaAmount: payment.reteIcaAmount,
          packagingCifAmount: payment.packagingCifAmount,
        });

        return {
          grossAmount: accumulator.grossAmount.plus(current.grossAmount),
          netReceivedAmount: accumulator.netReceivedAmount.plus(
            current.netReceivedAmount,
          ),
          commissionAmount: accumulator.commissionAmount.plus(
            current.commissionAmount,
          ),
          commissionVatAmount: accumulator.commissionVatAmount.plus(
            current.commissionVatAmount,
          ),
          reteFuenteAmount: accumulator.reteFuenteAmount.plus(
            current.reteFuenteAmount,
          ),
          reteIvaAmount: accumulator.reteIvaAmount.plus(current.reteIvaAmount),
          reteIcaAmount: accumulator.reteIcaAmount.plus(current.reteIcaAmount),
          packagingCifAmount: accumulator.packagingCifAmount.plus(
            current.packagingCifAmount,
          ),
        };
      },
      {
        grossAmount: new Decimal(0),
        netReceivedAmount: new Decimal(0),
        commissionAmount: new Decimal(0),
        commissionVatAmount: new Decimal(0),
        reteFuenteAmount: new Decimal(0),
        reteIvaAmount: new Decimal(0),
        reteIcaAmount: new Decimal(0),
        packagingCifAmount: new Decimal(0),
      },
    );

    const fallbackUnitCost = order.items.reduce((sum, item) => {
      const inventoryConsumption = this.extractInventoryConsumptionSnapshot(
        item.pricingJson,
      );
      if (inventoryConsumption) {
        return sum.plus(inventoryConsumption.totalCOGS);
      }

      const unitCost = item.variant?.totalCost ?? item.variant?.costPrice ?? 0;
      return sum.plus(toDecimal(unitCost).mul(item.quantity));
    }, new Decimal(0));

    const metrics = this.buildProfitabilityMetrics({
      grossAmount: order.totalAmount,
      netSalesWithoutVat: order.netAmount ?? 0,
      vatAmount: order.taxTotal ?? 0,
      productCost: fallbackUnitCost,
      commissionAmount: settlement.commissionAmount,
      commissionVatAmount: settlement.commissionVatAmount,
      logisticsCifAmount: settlement.packagingCifAmount,
      netReceivedAmount: settlement.netReceivedAmount,
      reteFuenteAmount: settlement.reteFuenteAmount,
      reteIvaAmount: settlement.reteIvaAmount,
      reteIcaAmount: settlement.reteIcaAmount,
    });

    const primaryPayment = order.payments[0];
    const isFullyPaid = roundMoney(order.balanceDue).lessThanOrEqualTo(0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      createdAt: order.createdAt,
      status: order.status,
      paymentProvider: primaryPayment?.provider ?? 'manual',
      paymentMethodType: primaryPayment?.paymentMethodType ?? 'N/D',
      ingresoBruto: decimalToNumber(metrics.grossAmount),
      ventaNetaSinIva: decimalToNumber(metrics.netSalesWithoutVat),
      iva: decimalToNumber(metrics.vatAmount),
      costoProducto: decimalToNumber(metrics.productCost),
      comisionWompi: decimalToNumber(metrics.commissionAmount),
      ivaComision: decimalToNumber(metrics.commissionVatAmount),
      costoLogisticoCif: decimalToNumber(metrics.logisticsCifAmount),
      utilidadBruta: decimalToNumber(metrics.grossProfit),
      utilidadOperativa: decimalToNumber(metrics.operatingProfit),
      utilidadNeta: decimalToNumber(metrics.netProfit),
      utilidadNetaReal: decimalToNumber(metrics.realNetProfit),
      netoRecibidoBanco: decimalToNumber(metrics.netReceivedAmount),
      retencionesActivas: decimalToNumber(metrics.retentionAsset),
      reteFuente: decimalToNumber(metrics.reteFuenteAmount),
      reteIva: decimalToNumber(metrics.reteIvaAmount),
      reteIca: decimalToNumber(metrics.reteIcaAmount),
      brutoVsNetoDelta: decimalToNumber(metrics.grossVsNetDelta),
      margenSobreNetoPasarela:
        metrics.marginOnGatewayNet === null
          ? null
          : metrics.marginOnGatewayNet
              .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
              .toNumber(),
      alertaMargenBajo: metrics.isBelowTarget,
      isFullyPaid,
    };
  }

  private getCashFlowDateKey(date: Date, period: 'daily' | 'monthly') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      ...(period === 'daily' ? { day: '2-digit' } : {}),
    });

    return formatter.format(date);
  }

  private buildCreatedAtFilter(startDate?: Date, endDate?: Date) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (startDate) {
      if (Number.isNaN(startDate.getTime())) {
        throw new BadRequestException('La fecha inicial es invalida');
      }
      createdAt.gte = startDate;
    }

    if (endDate) {
      if (Number.isNaN(endDate.getTime())) {
        throw new BadRequestException('La fecha final es invalida');
      }
      createdAt.lte = endDate;
    }

    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw new BadRequestException(
        'La fecha inicial no puede ser mayor que la fecha final',
      );
    }

    return Object.keys(createdAt).length > 0 ? createdAt : undefined;
  }

  private parseDateBoundary(value: string | undefined, isEndDate: boolean) {
    if (!value) {
      return undefined;
    }

    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T${isEndDate ? '23:59:59.999' : '00:00:00.000'}`)
      : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Rango de fechas invalido');
    }

    return parsed;
  }

  private buildDateRangeFilter(startDate?: string, endDate?: string) {
    return this.buildCreatedAtFilter(
      this.parseDateBoundary(startDate, false),
      this.parseDateBoundary(endDate, true),
    );
  }

  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private sanitizeCurrencyAmount(amount: number | null | undefined) {
    return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  }

  private toMoneyNumber(value: DecimalInput) {
    return decimalToNumber(value);
  }

  private serializeTransactionMoney<T extends Record<string, unknown> | null>(
    transaction: T,
  ): T {
    if (!transaction) {
      return transaction;
    }

    const result: Record<string, unknown> = { ...transaction };

    if ('amount' in result) {
      result.amount = this.toMoneyNumber(result.amount as DecimalInput);
    }

    return result as T;
  }

  private serializeSupplierMoney<T extends Record<string, unknown> | null>(
    supplier: T,
  ): T {
    if (!supplier) {
      return supplier;
    }

    const result: Record<string, unknown> = { ...supplier };

    if ('balance' in result) {
      result.balance = this.toMoneyNumber(result.balance as DecimalInput);
    }

    if (Array.isArray(result.transactions)) {
      result.transactions = result.transactions.map((transaction) =>
        this.serializeTransactionMoney(transaction as Record<string, unknown>),
      );
    }

    if (Array.isArray(result.batches)) {
      const batches = result.batches as unknown[];
      result.batches = batches.map((batch): unknown => {
        if (!batch || typeof batch !== 'object') {
          return batch;
        }

        const batchRecord = { ...(batch as Record<string, unknown>) };
        if ('unitCost' in batchRecord) {
          batchRecord.unitCost = this.toMoneyNumber(
            batchRecord.unitCost as DecimalInput,
          );
        }
        if ('totalCost' in batchRecord) {
          batchRecord.totalCost = this.toMoneyNumber(
            batchRecord.totalCost as DecimalInput,
          );
        }
        return batchRecord;
      });
    }

    return result as T;
  }

  private sanitizeText(value: unknown, fallback = 'N/D') {
    if (typeof value !== 'string') {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private normalizeCategoryName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getMonthKey(date: Date) {
    return this.getCashFlowDateKey(date, 'monthly');
  }

  private extractCogsFromPayload(payload: Prisma.JsonValue | null) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return 0;
    }

    const quantityReduced = payload.quantityReduced;
    const unitCost = payload.unitCost;

    if (
      typeof quantityReduced !== 'number' ||
      !Number.isFinite(quantityReduced)
    ) {
      return 0;
    }

    if (typeof unitCost !== 'number' || !Number.isFinite(unitCost)) {
      return 0;
    }

    return quantityReduced * unitCost;
  }

  private extractCogsDecimalFromPayload(payload: Prisma.JsonValue | null) {
    return roundMoney(this.extractCogsFromPayload(payload));
  }

  private isMissingFinanceStorageError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2021' || error.code === 'P2022';
    }

    if (error instanceof Error) {
      return /financial_transactions|FinancialTransaction|does not exist|column .* does not exist/i.test(
        error.message,
      );
    }

    return false;
  }

  private buildEmptyFinancialSummary() {
    return {
      kpis: {
        totalIncome: 0,
        totalOpex: 0,
        totalPurchases: 0,
        totalCOGS: null,
      },
      cashFlowChart: [],
      recentTransactions: [],
    };
  }

  private parseFixedExpenses(dto: BreakEvenSimulationDto) {
    const fixedExpenses = dto.fixedExpenses ?? [];
    const listedExpenses = fixedExpenses.reduce(
      (sum, item) => sum.plus(roundMoney(item.amount)),
      new Decimal(0),
    );
    const totalExpense = dto.fixedExpensesTotal
      ? roundMoney(dto.fixedExpensesTotal)
      : new Decimal(0);
    const total = roundMoney(totalExpense.plus(listedExpenses));

    if (total.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Los gastos fijos simulados deben ser mayores a cero',
      );
    }

    return {
      total,
      breakdown: [
        ...(dto.fixedExpensesTotal
          ? [
              {
                label: 'Total ingresado',
                amount: decimalToNumber(totalExpense),
              },
            ]
          : []),
        ...fixedExpenses.map((item) => ({
          label: item.label?.trim() || 'Gasto fijo',
          amount: decimalToNumber(item.amount),
        })),
      ],
    };
  }

  private buildDefaultFixedExpensesConfigRecord(): FixedExpenseConfigRecord {
    return {
      currency: 'COP',
      period: 'monthly',
      items: this.defaultFixedExpenseItems.map((item) => ({ ...item })),
    };
  }

  private createFixedExpenseItemId(label: string, index: number) {
    const normalized = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || `fixed-expense-${index + 1}`;
  }

  private normalizeFixedExpenseItems(
    items: unknown,
    fallbackItems = this.defaultFixedExpenseItems,
  ) {
    if (!Array.isArray(items)) {
      return fallbackItems.map((item) => ({ ...item }));
    }

    const usedIds = new Set<string>();
    const normalizedItems = items.flatMap((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      const candidate = item as Record<string, unknown>;
      const rawLabel =
        typeof candidate.label === 'string' ? candidate.label.trim() : '';
      if (!rawLabel) {
        return [];
      }

      const numericAmount = Number(candidate.amount ?? 0);
      const safeAmount =
        Number.isFinite(numericAmount) && numericAmount >= 0
          ? numericAmount
          : 0;
      const rawId =
        typeof candidate.id === 'string' && candidate.id.trim().length > 0
          ? candidate.id.trim()
          : this.createFixedExpenseItemId(rawLabel, index);
      let resolvedId = rawId;
      let duplicateCounter = 1;
      while (usedIds.has(resolvedId)) {
        duplicateCounter += 1;
        resolvedId = `${rawId}-${duplicateCounter}`;
      }
      usedIds.add(resolvedId);

      return [
        {
          id: resolvedId,
          label: rawLabel,
          amount: roundMoney(safeAmount).toNumber(),
        },
      ];
    });

    if (normalizedItems.length === 0) {
      return fallbackItems.map((item) => ({ ...item }));
    }

    return normalizedItems;
  }

  private parseFixedExpensesConfigRecord(
    rawValue: Prisma.JsonValue | null | undefined,
  ): FixedExpenseConfigRecord {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return this.buildDefaultFixedExpensesConfigRecord();
    }

    const record = rawValue as Record<string, unknown>;

    return {
      currency: 'COP',
      period: 'monthly',
      items: this.normalizeFixedExpenseItems(record.items),
    };
  }

  private buildFixedExpensesConfigResponse(
    record: FixedExpenseConfigRecord,
    updatedAt: Date | null,
  ): FixedExpenseConfigResponse {
    const monthlyTotal = record.items.reduce(
      (sum, item) => sum.plus(item.amount),
      new Decimal(0),
    );

    return {
      key: this.monthlyFixedExpensesSettingKey,
      currency: record.currency,
      period: record.period,
      monthlyTotal: decimalToNumber(roundMoney(monthlyTotal)),
      items: record.items.map((item) => ({ ...item })),
      isConfigured: monthlyTotal.greaterThan(0),
      updatedAt,
    };
  }

  private async readFixedExpensesSettingRow() {
    const rows = await this.prisma.$queryRaw<AppSettingRow[]>(Prisma.sql`
      SELECT "value", "updated_at"
      FROM "tote-bag"."app_settings"
      WHERE "key" = ${this.monthlyFixedExpensesSettingKey}
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  private async upsertFixedExpensesConfigRecord(
    record: FixedExpenseConfigRecord,
  ) {
    const payload = JSON.stringify(record);
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "tote-bag"."app_settings" ("key", "value", "created_at", "updated_at")
      VALUES (
        ${this.monthlyFixedExpensesSettingKey},
        CAST(${payload} AS jsonb),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("key") DO UPDATE
      SET
        "value" = EXCLUDED."value",
        "updated_at" = CURRENT_TIMESTAMP
    `);
  }

  private async ensureFixedExpensesConfig() {
    const existingRow = await this.readFixedExpensesSettingRow();

    if (existingRow) {
      return this.buildFixedExpensesConfigResponse(
        this.parseFixedExpensesConfigRecord(existingRow.value),
        existingRow.updated_at,
      );
    }

    const defaultRecord = this.buildDefaultFixedExpensesConfigRecord();
    await this.upsertFixedExpensesConfigRecord(defaultRecord);

    return this.buildFixedExpensesConfigResponse(defaultRecord, new Date());
  }

  private getInclusiveDayCount(startDate: Date, endDate: Date) {
    const start = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const end = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
    );

    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  private calculateProratedFixedExpenseTarget(
    startDate: Date,
    endDate: Date,
    monthlyTotal: Decimal,
  ) {
    if (monthlyTotal.lessThanOrEqualTo(0)) {
      return new Decimal(0);
    }

    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    let target = new Decimal(0);

    while (cursor <= endDate) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const overlapStart = startDate > monthStart ? startDate : monthStart;
      const overlapEnd = endDate < monthEnd ? endDate : monthEnd;

      if (overlapStart <= overlapEnd) {
        const coveredDays = this.getInclusiveDayCount(overlapStart, overlapEnd);
        const daysInMonth = monthEnd.getDate();
        target = target.plus(monthlyTotal.mul(coveredDays).div(daysInMonth));
      }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return roundMoney(target);
  }

  async getFixedExpensesConfig() {
    return this.ensureFixedExpensesConfig();
  }

  async updateFixedExpensesConfig(dto: UpdateFixedExpensesConfigDto) {
    const normalizedItems = this.normalizeFixedExpenseItems(dto.items, []);

    if (normalizedItems.length === 0) {
      throw new BadRequestException(
        'Debes registrar al menos un gasto fijo mensual.',
      );
    }

    const record: FixedExpenseConfigRecord = {
      currency: 'COP',
      period: 'monthly',
      items: normalizedItems,
    };

    await this.upsertFixedExpensesConfigRecord(record);

    return this.buildFixedExpensesConfigResponse(record, new Date());
  }

  private resolveDateRange({
    startDate,
    endDate,
    month,
    year,
  }: FinancialReportQuery) {
    if (startDate && endDate) {
      const parsedStart = new Date(`${startDate}T00:00:00`);
      const parsedEnd = new Date(`${endDate}T00:00:00`);

      if (
        Number.isNaN(parsedStart.getTime()) ||
        Number.isNaN(parsedEnd.getTime())
      ) {
        throw new BadRequestException('Rango de fechas invalido');
      }

      parsedStart.setHours(0, 0, 0, 0);
      parsedEnd.setHours(23, 59, 59, 999);

      return {
        startDate: parsedStart,
        endDate: parsedEnd,
        label: `${format(parsedStart, 'dd/MM/yyyy')} - ${format(parsedEnd, 'dd/MM/yyyy')}`,
      };
    }

    if (month && year) {
      const numericMonth = Number.parseInt(month, 10);
      const numericYear = Number.parseInt(year, 10);

      if (
        Number.isNaN(numericMonth) ||
        Number.isNaN(numericYear) ||
        numericMonth < 1 ||
        numericMonth > 12
      ) {
        throw new BadRequestException('Mes o anio invalido');
      }

      const parsedStart = new Date(numericYear, numericMonth - 1, 1);
      const parsedEnd = new Date(numericYear, numericMonth, 0, 23, 59, 59, 999);

      return {
        startDate: parsedStart,
        endDate: parsedEnd,
        label: `${format(parsedStart, 'MMMM yyyy')}`,
      };
    }

    if (year) {
      const numericYear = Number.parseInt(year, 10);

      if (Number.isNaN(numericYear)) {
        throw new BadRequestException('Anio invalido');
      }

      const parsedStart = new Date(numericYear, 0, 1);
      const parsedEnd = new Date(numericYear, 11, 31, 23, 59, 59, 999);

      return {
        startDate: parsedStart,
        endDate: parsedEnd,
        label: `${numericYear}`,
      };
    }

    const today = new Date();
    const parsedStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const parsedEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999,
    );

    return {
      startDate: parsedStart,
      endDate: parsedEnd,
      label: format(parsedStart, 'dd/MM/yyyy'),
    };
  }

  private async getPaidOrdersInRange(startDate: Date, endDate: Date) {
    return this.prisma.order.findMany({
      where: {
        statusHistory: {
          some: {
            status: OrderStatus.PAGADA,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
          },
        },
        statusHistory: {
          where: {
            status: OrderStatus.PAGADA,
          },
          orderBy: { createdAt: 'asc' },
        },
        shipment: {
          select: {
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<FinancialReportOrder[]>;
  }

  private buildFinancialReportMetrics(
    orders: FinancialReportOrder[],
    startDate: Date,
    endDate: Date,
  ) {
    const paidOrders = orders.filter((order) =>
      order.statusHistory.some(
        (entry) =>
          entry.status === OrderStatus.PAGADA &&
          entry.createdAt >= startDate &&
          entry.createdAt <= endDate,
      ),
    );

    const returnedOrders = orders.filter(
      (order) =>
        order.shipment?.status === ShipmentStatus.RETURNED &&
        order.shipment.updatedAt >= startDate &&
        order.shipment.updatedAt <= endDate,
    );

    const grossSales = paidOrders.reduce(
      (sum, order) => sum.plus(toDecimal(order.totalAmount)),
      new Decimal(0),
    );
    const returnsTotal = returnedOrders.reduce(
      (sum, order) => sum.plus(toDecimal(order.totalAmount)),
      new Decimal(0),
    );
    const subtotal = paidOrders
      .reduce(
        (sum, order) => sum.plus(toDecimal(order.netAmount)),
        new Decimal(0),
      )
      .minus(
        returnedOrders.reduce(
          (sum, order) => sum.plus(toDecimal(order.netAmount)),
          new Decimal(0),
        ),
      );
    const estimatedTaxes = paidOrders
      .reduce(
        (sum, order) => sum.plus(toDecimal(order.taxTotal)),
        new Decimal(0),
      )
      .minus(
        returnedOrders.reduce(
          (sum, order) => sum.plus(toDecimal(order.taxTotal)),
          new Decimal(0),
        ),
      );
    const netSales = grossSales.minus(returnsTotal);
    const totalItems = paidOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemsSum, item) => itemsSum + item.quantity, 0),
      0,
    );

    const returnItems = returnedOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((itemsSum, item) => itemsSum + item.quantity, 0),
      0,
    );

    return {
      paidOrders,
      returnedOrders,
      summary: {
        orderCount: paidOrders.length,
        returnedOrderCount: returnedOrders.length,
        totalItems,
        returnItems,
        grossSales: decimalToNumber(grossSales),
        returnsTotal: decimalToNumber(returnsTotal),
        subtotal: decimalToNumber(subtotal),
        estimatedTaxes: decimalToNumber(estimatedTaxes),
        netBalance: decimalToNumber(netSales),
      },
    };
  }

  async getFinancialReportPreview(query: FinancialReportQuery) {
    const { startDate, endDate, label } = this.resolveDateRange(query);
    const orders = await this.getPaidOrdersInRange(startDate, endDate);
    const metrics = this.buildFinancialReportMetrics(
      orders,
      startDate,
      endDate,
    );

    return {
      period: {
        label,
        startDate,
        endDate,
      },
      ...metrics.summary,
    };
  }

  async generateFinancialReportPdf(query: FinancialReportQuery) {
    const { startDate, endDate, label } = this.resolveDateRange(query);
    const orders = await this.getPaidOrdersInRange(startDate, endDate);
    const metrics = this.buildFinancialReportMetrics(
      orders,
      startDate,
      endDate,
    );

    return {
      fileName: `Reporte_Financiero_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}.pdf`,
      buffer: await this.renderFinancialReportPdf(
        label,
        startDate,
        endDate,
        metrics,
      ),
    };
  }

  private async getCollectedOrdersForProfitability(query: {
    startDate?: string;
    endDate?: string;
  }) {
    const createdAtFilter = this.buildDateRangeFilter(
      query.startDate,
      query.endDate,
    );

    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        status: { in: this.revenueOrderStatuses },
        balanceDue: { lte: 0 },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        createdAt: true,
        status: true,
        totalAmount: true,
        netAmount: true,
        taxTotal: true,
        amountPaid: true,
        balanceDue: true,
        items: {
          select: {
            id: true,
            sku: true,
            quantity: true,
            pricingJson: true,
            variant: {
              select: {
                costPrice: true,
                totalCost: true,
                taxRate: true,
              },
            },
          },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            provider: true,
            paymentMethodType: true,
            grossAmount: true,
            netReceivedAmount: true,
            commissionAmount: true,
            commissionVatAmount: true,
            reteFuenteAmount: true,
            reteIvaAmount: true,
            reteIcaAmount: true,
            packagingCifAmount: true,
            settlementSource: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<OrderProfitabilityOrderRecord[]>;
  }

  async getOrderProfitabilityReport(query: {
    startDate?: string;
    endDate?: string;
  }) {
    const orders = await this.getCollectedOrdersForProfitability(query);
    const profitabilityOrders = orders.map((order) =>
      this.buildOrderProfitabilityRow(order),
    );

    const summaryAccumulator = profitabilityOrders.reduce(
      (accumulator, order) => ({
        grossRevenue: accumulator.grossRevenue.plus(order.ingresoBruto),
        netSalesWithoutVat: accumulator.netSalesWithoutVat.plus(
          order.ventaNetaSinIva,
        ),
        vatLiability: accumulator.vatLiability.plus(order.iva),
        productCost: accumulator.productCost.plus(order.costoProducto),
        commissionAmount: accumulator.commissionAmount.plus(
          order.comisionWompi,
        ),
        commissionVatAmount: accumulator.commissionVatAmount.plus(
          order.ivaComision,
        ),
        logisticsCifAmount: accumulator.logisticsCifAmount.plus(
          order.costoLogisticoCif,
        ),
        grossProfit: accumulator.grossProfit.plus(order.utilidadBruta),
        operatingProfit: accumulator.operatingProfit.plus(
          order.utilidadOperativa,
        ),
        netProfit: accumulator.netProfit.plus(order.utilidadNeta),
        realNetProfit: accumulator.realNetProfit.plus(order.utilidadNetaReal),
        netReceivedBank: accumulator.netReceivedBank.plus(
          order.netoRecibidoBanco,
        ),
        retentionAssetTotal: accumulator.retentionAssetTotal.plus(
          order.retencionesActivas,
        ),
        reteFuenteTotal: accumulator.reteFuenteTotal.plus(order.reteFuente),
        reteIvaTotal: accumulator.reteIvaTotal.plus(order.reteIva),
        reteIcaTotal: accumulator.reteIcaTotal.plus(order.reteIca),
        grossVsNetDelta: accumulator.grossVsNetDelta.plus(
          order.brutoVsNetoDelta,
        ),
        belowTargetCount:
          accumulator.belowTargetCount + (order.alertaMargenBajo ? 1 : 0),
      }),
      {
        grossRevenue: new Decimal(0),
        netSalesWithoutVat: new Decimal(0),
        vatLiability: new Decimal(0),
        productCost: new Decimal(0),
        commissionAmount: new Decimal(0),
        commissionVatAmount: new Decimal(0),
        logisticsCifAmount: new Decimal(0),
        grossProfit: new Decimal(0),
        operatingProfit: new Decimal(0),
        netProfit: new Decimal(0),
        realNetProfit: new Decimal(0),
        netReceivedBank: new Decimal(0),
        retentionAssetTotal: new Decimal(0),
        reteFuenteTotal: new Decimal(0),
        reteIvaTotal: new Decimal(0),
        reteIcaTotal: new Decimal(0),
        grossVsNetDelta: new Decimal(0),
        belowTargetCount: 0,
      },
    );

    const marginOnGatewayNet = summaryAccumulator.netReceivedBank.greaterThan(0)
      ? roundMoney(
          summaryAccumulator.realNetProfit.div(
            summaryAccumulator.netReceivedBank,
          ),
        )
      : null;

    const summary: OrderProfitabilitySummary = {
      orderCount: profitabilityOrders.length,
      grossRevenue: decimalToNumber(summaryAccumulator.grossRevenue),
      netSalesWithoutVat: decimalToNumber(
        summaryAccumulator.netSalesWithoutVat,
      ),
      vatLiability: decimalToNumber(summaryAccumulator.vatLiability),
      productCost: decimalToNumber(summaryAccumulator.productCost),
      commissionAmount: decimalToNumber(summaryAccumulator.commissionAmount),
      commissionVatAmount: decimalToNumber(
        summaryAccumulator.commissionVatAmount,
      ),
      logisticsCifAmount: decimalToNumber(
        summaryAccumulator.logisticsCifAmount,
      ),
      grossProfit: decimalToNumber(summaryAccumulator.grossProfit),
      operatingProfit: decimalToNumber(summaryAccumulator.operatingProfit),
      netProfit: decimalToNumber(summaryAccumulator.netProfit),
      realNetProfit: decimalToNumber(summaryAccumulator.realNetProfit),
      netReceivedBank: decimalToNumber(summaryAccumulator.netReceivedBank),
      retentionAssetTotal: decimalToNumber(
        summaryAccumulator.retentionAssetTotal,
      ),
      reteFuenteTotal: decimalToNumber(summaryAccumulator.reteFuenteTotal),
      reteIvaTotal: decimalToNumber(summaryAccumulator.reteIvaTotal),
      reteIcaTotal: decimalToNumber(summaryAccumulator.reteIcaTotal),
      grossVsNetDelta: decimalToNumber(summaryAccumulator.grossVsNetDelta),
      marginOnGatewayNet:
        marginOnGatewayNet === null
          ? null
          : marginOnGatewayNet
              .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
              .toNumber(),
      marginTarget: this.gatewayMarginTarget.toNumber(),
      belowTargetCount: summaryAccumulator.belowTargetCount,
    };

    return {
      summary,
      orders: profitabilityOrders,
    };
  }

  private async renderFinancialReportPdf(
    label: string,
    startDate: Date,
    endDate: Date,
    metrics: ReturnType<FinanceService['buildFinancialReportMetrics']>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 42,
        size: 'LETTER',
        info: { Title: 'Reporte Financiero - Tote Bag' },
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error: Error) => reject(error));

      const drawMoney = (amount: DecimalInput) =>
        this.formatCurrency(
          this.sanitizeCurrencyAmount(decimalToNumber(amount)),
        );
      const drawLine = (y: number, color = '#E5E7EB') => {
        doc
          .moveTo(42, y)
          .lineTo(570, y)
          .strokeColor(color)
          .lineWidth(1)
          .stroke();
      };

      let y = 42;
      doc.rect(0, 0, 612, 92).fillColor('#F5F7FA').fill();
      doc.rect(0, 0, 8, 92).fillColor('#111827').fill();

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('TOTE BAG', 42, y);
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text('Reporte Financiero Oficial', 42, y + 24);
      doc.text(`Periodo: ${label}`, 42, y + 40);
      doc.text(
        `Emitido: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
        42,
        y + 54,
      );

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text('RANGO CONTABLE', 390, y + 6, { width: 170, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#4B5563')
        .text(
          `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`,
          390,
          y + 24,
          { width: 170, align: 'right' },
        );

      y = 122;

      const card = (
        x: number,
        title: string,
        value: string,
        accent: string,
      ) => {
        doc
          .roundedRect(x, y, 122, 58, 12)
          .fillColor('#FFFFFF')
          .strokeColor('#E5E7EB')
          .lineWidth(1)
          .fillAndStroke();
        doc.rect(x, y, 4, 58).fillColor(accent).fill();
        doc
          .fillColor('#6B7280')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(title.toUpperCase(), x + 14, y + 12, { width: 94 });
        doc
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(value, x + 14, y + 28, { width: 94 });
      };

      card(
        42,
        'Ordenes pagadas',
        String(metrics.summary.orderCount),
        '#111827',
      );
      card(
        178,
        'Ventas brutas',
        drawMoney(metrics.summary.grossSales),
        '#059669',
      );
      card(
        314,
        'Devoluciones',
        drawMoney(metrics.summary.returnsTotal),
        '#DC2626',
      );
      card(
        450,
        'Balance neto',
        drawMoney(metrics.summary.netBalance),
        '#2563EB',
      );

      y += 82;
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Resumen financiero', 42, y);
      y += 18;
      drawLine(y);
      y += 10;

      const summaryRows: Array<[string, number, string?]> = [
        ['Subtotal operativo', metrics.summary.subtotal],
        ['Impuestos estimados', metrics.summary.estimatedTaxes],
        ['Ventas brutas', metrics.summary.grossSales],
        ['Devoluciones aplicadas', -metrics.summary.returnsTotal, '#DC2626'],
        ['Balance final', metrics.summary.netBalance, '#2563EB'],
      ];

      summaryRows.forEach(([labelText, amount, color]) => {
        doc
          .fillColor('#374151')
          .font('Helvetica')
          .fontSize(10)
          .text(labelText, 42, y);
        doc
          .fillColor(color || '#111827')
          .font('Helvetica-Bold')
          .text(drawMoney(amount), 380, y, { width: 180, align: 'right' });
        y += 18;
      });

      y += 8;
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Detalle de ordenes pagadas', 42, y);
      y += 18;
      drawLine(y);
      y += 8;

      const renderTableHeader = (headerY: number) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#6B7280');
        doc.text('Orden', 42, headerY);
        doc.text('Cliente', 112, headerY, { width: 170 });
        doc.text('Fecha pago', 292, headerY, { width: 88 });
        doc.text('Items', 390, headerY, { width: 50, align: 'center' });
        doc.text('Total', 448, headerY, { width: 112, align: 'right' });
      };

      renderTableHeader(y);
      y += 14;
      drawLine(y);
      y += 6;

      metrics.paidOrders.forEach((order) => {
        if (y > 700) {
          doc.addPage();
          y = 48;
          renderTableHeader(y);
          y += 14;
          drawLine(y);
          y += 6;
        }

        const paidAt =
          order.statusHistory.find(
            (entry) => entry.status === OrderStatus.PAGADA,
          )?.createdAt || order.createdAt;
        const totalItems = order.items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#111827')
          .text(
            `#${this.sanitizeText(
              order.orderNumber === null || order.orderNumber === undefined
                ? null
                : String(order.orderNumber),
            )}`,
            42,
            y,
          );
        doc
          .font('Helvetica')
          .fillColor('#374151')
          .text(this.sanitizeText(order.customerEmail), 112, y, {
            width: 170,
            ellipsis: true,
          });
        doc.text(format(paidAt, 'dd/MM/yyyy'), 292, y, { width: 88 });
        doc.text(String(totalItems), 390, y, { width: 50, align: 'center' });
        doc.font('Helvetica-Bold').text(drawMoney(order.totalAmount), 448, y, {
          width: 112,
          align: 'right',
        });
        y += 18;
        drawLine(y, '#F3F4F6');
        y += 6;
      });

      y += 10;
      if (y > 620) {
        doc.addPage();
        y = 48;
      }

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Devoluciones', 42, y);
      y += 18;
      drawLine(y);
      y += 8;

      if (metrics.returnedOrders.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#6B7280')
          .text(
            'No se registraron devoluciones en el periodo seleccionado.',
            42,
            y,
          );
        y += 18;
      } else {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#6B7280');
        doc.text('Orden', 42, y);
        doc.text('Fecha retorno', 112, y, { width: 110 });
        doc.text('Estado', 230, y, { width: 120 });
        doc.text('Monto restado', 420, y, { width: 140, align: 'right' });
        y += 14;
        drawLine(y);
        y += 6;

        metrics.returnedOrders.forEach((order) => {
          if (y > 700) {
            doc.addPage();
            y = 48;
          }

          const returnedAt = order.shipment?.updatedAt || order.createdAt;

          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#111827')
            .text(
              `#${this.sanitizeText(
                order.orderNumber === null || order.orderNumber === undefined
                  ? null
                  : String(order.orderNumber),
              )}`,
              42,
              y,
            );
          doc
            .font('Helvetica')
            .fillColor('#374151')
            .text(format(returnedAt, 'dd/MM/yyyy'), 112, y, { width: 110 });
          doc.text(
            this.sanitizeText(order.shipment?.status, 'RETURNED'),
            230,
            y,
            {
              width: 120,
            },
          );
          doc
            .font('Helvetica-Bold')
            .fillColor('#DC2626')
            .text(drawMoney(-order.totalAmount), 420, y, {
              width: 140,
              align: 'right',
            });
          y += 18;
          drawLine(y, '#F3F4F6');
          y += 6;
        });
      }

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#9CA3AF')
        .text(
          'Documento interno para uso exclusivo de administracion. Totales calculados sobre ordenes marcadas como PAGADA y devoluciones con envio en estado RETURNED dentro del periodo.',
          42,
          742,
          { width: 520, align: 'center' },
        );

      doc.end();
    });
  }

  async createTransaction(data: {
    type: TransactionType;
    category: TransactionCategory;
    amount: number;
    description: string;
    userId: string;
    purchaseBatchId?: string;
  }) {
    const transaction = await this.prisma.financialTransaction.create({
      data,
    });

    return this.serializeTransactionMoney(transaction);
  }

  async getSalesTaxReport(query: { startDate?: string; endDate?: string }) {
    const profitability = await this.getOrderProfitabilityReport(query);
    const taxableBase = toDecimal(profitability.summary.netSalesWithoutVat);
    const taxTotal = toDecimal(profitability.summary.vatLiability);
    const grossTotal = toDecimal(profitability.summary.grossRevenue);
    const vatNetAfterReteIva = roundMoney(
      taxTotal.minus(profitability.summary.reteIvaTotal),
    );

    return {
      orderCount: profitability.summary.orderCount,
      taxableBase: decimalToNumber(taxableBase),
      taxTotal: decimalToNumber(taxTotal),
      grossTotal: decimalToNumber(grossTotal),
      vatLiabilityToReserve: decimalToNumber(taxTotal),
      reteIvaCredit: profitability.summary.reteIvaTotal,
      vatNetAfterReteIva: decimalToNumber(vatNetAfterReteIva),
      withholdingAssetTotal: profitability.summary.retentionAssetTotal,
      reconciliationDifference: decimalToNumber(
        grossTotal.minus(taxableBase.plus(taxTotal)),
      ),
      orders: profitability.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        status: order.status,
        createdAt: order.createdAt,
        totalAmount: order.ingresoBruto,
        netAmount: order.ventaNetaSinIva,
        taxTotal: order.iva,
        reteIvaAmount: order.reteIva,
        netReceivedAmount: order.netoRecibidoBanco,
      })),
    };
  }

  async getRetentionReport(query: { startDate?: string; endDate?: string }) {
    const profitability = await this.getOrderProfitabilityReport(query);
    const monthlyMap = profitability.orders.reduce<
      Record<
        string,
        {
          reteFuente: Decimal;
          reteIva: Decimal;
          reteIca: Decimal;
          total: Decimal;
          orderCount: number;
        }
      >
    >((accumulator, order) => {
      const month = this.getMonthKey(order.createdAt);
      if (!accumulator[month]) {
        accumulator[month] = {
          reteFuente: new Decimal(0),
          reteIva: new Decimal(0),
          reteIca: new Decimal(0),
          total: new Decimal(0),
          orderCount: 0,
        };
      }

      accumulator[month].reteFuente = accumulator[month].reteFuente.plus(
        order.reteFuente,
      );
      accumulator[month].reteIva = accumulator[month].reteIva.plus(
        order.reteIva,
      );
      accumulator[month].reteIca = accumulator[month].reteIca.plus(
        order.reteIca,
      );
      accumulator[month].total = accumulator[month].total.plus(
        order.retencionesActivas,
      );
      accumulator[month].orderCount += 1;

      return accumulator;
    }, {});

    return {
      summary: {
        orderCount: profitability.summary.orderCount,
        reteFuenteTotal: profitability.summary.reteFuenteTotal,
        reteIvaTotal: profitability.summary.reteIvaTotal,
        reteIcaTotal: profitability.summary.reteIcaTotal,
        retentionAssetTotal: profitability.summary.retentionAssetTotal,
      },
      months: Object.entries(monthlyMap)
        .map(([month, value]) => ({
          month,
          orderCount: value.orderCount,
          reteFuente: decimalToNumber(value.reteFuente),
          reteIva: decimalToNumber(value.reteIva),
          reteIca: decimalToNumber(value.reteIca),
          total: decimalToNumber(value.total),
        }))
        .sort((left, right) => left.month.localeCompare(right.month)),
      orders: profitability.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        createdAt: order.createdAt,
        reteFuente: order.reteFuente,
        reteIva: order.reteIva,
        reteIca: order.reteIca,
        total: order.retencionesActivas,
      })),
    };
  }

  async getBreakEvenThermometer(
    query: FinancialReportQuery,
  ): Promise<BreakEvenThermometerReport> {
    const { startDate, endDate, label } = this.resolveDateRange(query);
    const [fixedExpensesConfig, profitability] = await Promise.all([
      this.ensureFixedExpensesConfig(),
      this.getOrderProfitabilityReport({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      }),
    ]);

    const accumulatedNetProfit = roundMoney(
      profitability.summary.realNetProfit,
    );
    const targetFixedExpenses = this.calculateProratedFixedExpenseTarget(
      startDate,
      endDate,
      toDecimal(fixedExpensesConfig.monthlyTotal),
    );
    const progressRatio =
      fixedExpensesConfig.isConfigured && targetFixedExpenses.greaterThan(0)
        ? accumulatedNetProfit.div(targetFixedExpenses)
        : new Decimal(0);
    const remainingToBreakEven = accumulatedNetProfit.lessThan(
      targetFixedExpenses,
    )
      ? roundMoney(targetFixedExpenses.minus(accumulatedNetProfit))
      : new Decimal(0);
    const surplusOverBreakEven = accumulatedNetProfit.greaterThan(
      targetFixedExpenses,
    )
      ? roundMoney(accumulatedNetProfit.minus(targetFixedExpenses))
      : new Decimal(0);

    return {
      period: {
        label,
        startDate,
        endDate,
      },
      fixedExpensesConfig,
      orderCount: profitability.summary.orderCount,
      accumulatedNetProfit: decimalToNumber(accumulatedNetProfit),
      targetFixedExpenses: decimalToNumber(targetFixedExpenses),
      progressRatio: progressRatio
        .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
        .toNumber(),
      progressPercentage: roundMoney(progressRatio.mul(100)).toNumber(),
      progressPercentageCapped: Decimal.max(
        0,
        Decimal.min(progressRatio.mul(100), new Decimal(140)),
      ).toNumber(),
      remainingToBreakEven: decimalToNumber(remainingToBreakEven),
      surplusOverBreakEven: decimalToNumber(surplusOverBreakEven),
      status:
        !fixedExpensesConfig.isConfigured ||
        targetFixedExpenses.lessThanOrEqualTo(0)
          ? 'UNCONFIGURED'
          : accumulatedNetProfit.greaterThanOrEqualTo(targetFixedExpenses)
            ? 'BREAK_EVEN_REACHED'
            : 'IN_PROGRESS',
    };
  }

  getGatewayMarginGrid(input: {
    grossAmount: number;
    productCost: number;
    taxRate?: number;
    marginTarget?: number;
    targetMargins?: number[];
  }): GatewayMarginGridResult {
    if (!Number.isFinite(input.grossAmount) || input.grossAmount <= 0) {
      throw new BadRequestException('El ingreso bruto debe ser mayor a 0.');
    }

    if (!Number.isFinite(input.productCost) || input.productCost < 0) {
      throw new BadRequestException(
        'El costo del producto no puede ser negativo.',
      );
    }

    const taxRate = toDecimal(input.taxRate ?? 0.19);
    const marginTarget = this.normalizeRateDecimal(
      input.marginTarget ?? this.gatewayMarginTarget.toNumber(),
    );
    if (taxRate.lessThan(0) || taxRate.greaterThan(1)) {
      throw new BadRequestException('La tarifa IVA debe estar entre 0 y 1.');
    }

    const taxBreakdown = calculateGrossTaxBreakdown({
      grossAmount: input.grossAmount,
      taxRate,
    });
    const settlement = this.buildPaymentSettlementBreakdown({
      amount: input.grossAmount,
      provider: 'wompi',
      grossAmount: input.grossAmount,
    });
    const profitability = this.buildProfitabilityMetrics({
      grossAmount: taxBreakdown.grossAmount,
      netSalesWithoutVat: taxBreakdown.netAmount,
      vatAmount: taxBreakdown.taxAmount,
      productCost: input.productCost,
      commissionAmount: settlement.commissionAmount,
      commissionVatAmount: settlement.commissionVatAmount,
      logisticsCifAmount: settlement.packagingCifAmount,
      netReceivedAmount: settlement.netReceivedAmount,
      reteFuenteAmount: settlement.reteFuenteAmount,
      reteIvaAmount: settlement.reteIvaAmount,
      reteIcaAmount: settlement.reteIcaAmount,
      marginTarget,
    });

    const config = this.getFinancialGatewayConfig();
    const targetMargins = (
      input.targetMargins ?? [marginTarget.toNumber()]
    ).map(
      (value) => {
        const decimalValue = toDecimal(value);
        return decimalValue.greaterThan(1)
          ? decimalValue.div(100)
          : decimalValue;
      },
    );
    const gatewayRate = roundMoney(
      config.commissionPercent.mul(
        new Decimal(1).plus(config.commissionVatPercent),
      ),
    );
    const fixedGatewayCost = roundMoney(
      config.fixedFeeCop
        .mul(new Decimal(1).plus(config.commissionVatPercent))
        .plus(config.packagingCifCop),
    );
    const retentionRate = roundMoney(
      config.reteFuentePercent
        .plus(config.reteIvaPercent)
        .plus(config.reteIcaPercent),
    );

    return {
      config: {
        commissionPercent: config.commissionPercent.toNumber(),
        fixedFeeCop: decimalToNumber(config.fixedFeeCop),
        packagingCifCop: decimalToNumber(config.packagingCifCop),
        commissionVatPercent: config.commissionVatPercent.toNumber(),
        reteFuentePercent: config.reteFuentePercent.toNumber(),
        reteIvaPercent: config.reteIvaPercent.toNumber(),
        reteIcaPercent: config.reteIcaPercent.toNumber(),
      },
      current: {
        ingresoBruto: decimalToNumber(profitability.grossAmount),
        ventaNetaSinIva: decimalToNumber(profitability.netSalesWithoutVat),
        iva: decimalToNumber(profitability.vatAmount),
        costoProducto: decimalToNumber(profitability.productCost),
        comisionWompi: decimalToNumber(profitability.commissionAmount),
        ivaComision: decimalToNumber(profitability.commissionVatAmount),
        costoLogisticoCif: decimalToNumber(profitability.logisticsCifAmount),
        netoRecibidoBanco: decimalToNumber(profitability.netReceivedAmount),
        retencionesActivas: decimalToNumber(profitability.retentionAsset),
        utilidadBruta: decimalToNumber(profitability.grossProfit),
        utilidadOperativa: decimalToNumber(profitability.operatingProfit),
        utilidadNeta: decimalToNumber(profitability.realNetProfit),
        margenSobreNetoPasarela:
          profitability.marginOnGatewayNet === null
            ? null
            : profitability.marginOnGatewayNet
                .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
                .toNumber(),
        alertaMargenBajo: profitability.isBelowTarget,
      },
      targets: targetMargins.map((targetMargin) => {
        const target = roundMoney(targetMargin);
        const denominator = roundMoney(
          new Decimal(1)
            .div(new Decimal(1).plus(taxRate))
            .minus(gatewayRate)
            .minus(
              target.mul(
                new Decimal(1).minus(gatewayRate).minus(retentionRate),
              ),
            ),
        );
        if (denominator.lessThanOrEqualTo(0)) {
          return {
            targetMargin: target.toNumber(),
            requiredGrossAmount: null,
            requiredNetReceivedAmount: null,
            expectedNetProfit: null,
            reachable: false,
          };
        }

        const requiredGrossAmount = roundMoney(
          toDecimal(input.productCost).plus(
            fixedGatewayCost.mul(new Decimal(1).minus(target)),
          ),
        ).div(denominator);
        const expectedSettlement = this.buildPaymentSettlementBreakdown({
          amount: requiredGrossAmount,
          provider: 'wompi',
          grossAmount: requiredGrossAmount,
        });
        const expectedProfitability = this.buildProfitabilityMetrics({
          grossAmount: requiredGrossAmount,
          netSalesWithoutVat: calculateGrossTaxBreakdown({
            grossAmount: requiredGrossAmount,
            taxRate,
          }).netAmount,
          productCost: input.productCost,
          commissionAmount: expectedSettlement.commissionAmount,
          commissionVatAmount: expectedSettlement.commissionVatAmount,
          logisticsCifAmount: expectedSettlement.packagingCifAmount,
          netReceivedAmount: expectedSettlement.netReceivedAmount,
          reteFuenteAmount: expectedSettlement.reteFuenteAmount,
          reteIvaAmount: expectedSettlement.reteIvaAmount,
          reteIcaAmount: expectedSettlement.reteIcaAmount,
        });

        return {
          targetMargin: target.toNumber(),
          requiredGrossAmount: decimalToNumber(requiredGrossAmount),
          requiredNetReceivedAmount: decimalToNumber(
            expectedProfitability.netReceivedAmount,
          ),
          expectedNetProfit: decimalToNumber(
            expectedProfitability.realNetProfit,
          ),
          reachable: true,
        };
      }),
    };
  }

  async simulateBreakEven(dto: BreakEvenSimulationDto) {
    const { total: fixedExpensesTotal, breakdown } =
      this.parseFixedExpenses(dto);
    const createdAtFilter = this.buildDateRangeFilter(
      dto.startDate,
      dto.endDate,
    );

    const [orders, cogsLogs] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: { in: this.revenueOrderStatuses },
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
        select: {
          id: true,
          totalAmount: true,
          netAmount: true,
          taxTotal: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'REDUCE_STOCK_FIFO',
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
        select: { payload: true },
      }),
    ]);

    const netSales = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.netAmount)),
      new Decimal(0),
    );
    const grossSales = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.totalAmount)),
      new Decimal(0),
    );
    const taxTotal = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.taxTotal)),
      new Decimal(0),
    );
    const variableCosts = cogsLogs.reduce(
      (sum, log) => sum.plus(this.extractCogsDecimalFromPayload(log.payload)),
      new Decimal(0),
    );
    const contributionMargin = roundMoney(netSales.minus(variableCosts));
    const contributionMarginRatio = netSales.greaterThan(0)
      ? contributionMargin.div(netSales)
      : new Decimal(0);
    const breakEvenSales = contributionMarginRatio.greaterThan(0)
      ? roundMoney(fixedExpensesTotal.div(contributionMarginRatio))
      : null;

    return {
      formula:
        'puntoEquilibrioVentas = gastosFijos / (margenContribucion / ventasNetas)',
      orderCount: orders.length,
      fixedExpensesTotal: decimalToNumber(fixedExpensesTotal),
      fixedExpenses: breakdown,
      grossSales: decimalToNumber(grossSales),
      taxTotal: decimalToNumber(taxTotal),
      netSales: decimalToNumber(netSales),
      variableCosts: decimalToNumber(variableCosts),
      contributionMargin: decimalToNumber(contributionMargin),
      contributionMarginRatio: contributionMarginRatio
        .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
        .toNumber(),
      breakEvenSales:
        breakEvenSales === null ? null : decimalToNumber(breakEvenSales),
      isBreakEvenReachable: breakEvenSales !== null,
    };
  }

  async getSupplierBalance(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { balance: true },
    });

    return supplier ? this.toMoneyNumber(supplier.balance) : 0;
  }

  async createSupplier(data: {
    name: string;
    nit: string;
    contact?: string;
    phone?: string;
    email?: string;
  }) {
    const payload = {
      name: data.name.trim(),
      nit: data.nit.trim(),
      contact: data.contact?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
    };

    if (!payload.name || !payload.nit) {
      throw new BadRequestException('El nombre y el NIT son obligatorios');
    }

    try {
      return await this.prisma.supplier.create({ data: payload });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const metaTarget = error.meta?.target;
        const target = Array.isArray(metaTarget)
          ? metaTarget.join(', ')
          : typeof metaTarget === 'string'
            ? metaTarget
            : '';

        if (target.includes('nit')) {
          throw new ConflictException('Ya existe un proveedor con ese NIT');
        }
      }

      throw error;
    }
  }

  async updateSupplier(
    id: string,
    data: {
      name?: string;
      nit?: string;
      contact?: string;
      phone?: string;
      email?: string;
    },
  ) {
    const existingSupplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingSupplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const payload = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.nit !== undefined ? { nit: data.nit.trim() } : {}),
      ...(data.contact !== undefined
        ? { contact: data.contact.trim() || null }
        : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() || null } : {}),
    };

    if ('name' in payload && !payload.name) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    if ('nit' in payload && !payload.nit) {
      throw new BadRequestException('El NIT es obligatorio');
    }

    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: payload,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const metaTarget = error.meta?.target;
        const target = Array.isArray(metaTarget)
          ? metaTarget.join(', ')
          : typeof metaTarget === 'string'
            ? metaTarget
            : '';

        if (target.includes('nit')) {
          throw new ConflictException('Ya existe un proveedor con ese NIT');
        }
      }

      throw error;
    }
  }

  async findAllSuppliers() {
    const suppliers = await this.prisma.supplier.findMany({
      include: {
        _count: { select: { batches: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Enhance with current balance
    return Promise.all(
      suppliers.map(async (s) => ({
        ...this.serializeSupplierMoney(s),
        currentBalance: await this.getSupplierBalance(s.id),
      })),
    );
  }

  async getSupplierDetails(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        batches: {
          include: { product: true },
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) return null;

    return {
      ...this.serializeSupplierMoney(supplier),
      currentBalance: await this.getSupplierBalance(id),
    };
  }

  async createSupplierPayment(data: {
    supplierId: string;
    amount: number;
    description: string;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (data.amount <= 0) {
        throw new BadRequestException('El pago debe ser mayor a cero');
      }

      const supplier = await tx.supplier.findUnique({
        where: { id: data.supplierId },
        select: { balance: true },
      });

      if (!supplier) {
        throw new BadRequestException('Proveedor no encontrado');
      }

      const paymentAmount = roundMoney(data.amount);
      const supplierBalance = roundMoney(supplier.balance);

      if (paymentAmount.greaterThan(supplierBalance)) {
        throw new BadRequestException(
          'El pago no puede superar el saldo pendiente del proveedor',
        );
      }

      const transaction = await tx.financialTransaction.create({
        data: {
          type: TransactionType.EXPENSE,
          category: TransactionCategory.PURCHASE,
          amount: paymentAmount,
          description: data.description,
          supplierId: data.supplierId,
          userId: data.userId,
        },
      });

      await tx.supplier.update({
        where: { id: data.supplierId },
        data: {
          balance: {
            decrement: paymentAmount,
          },
        },
      });

      return this.serializeTransactionMoney(transaction);
    });
  }

  async getOpexCategories() {
    const categories = await this.prisma.opexCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      // Seed if empty
      const defaultCategories = [
        'Nómina',
        'Arriendo',
        'Servicios',
        'Marketing',
        'Mantenimiento',
      ];
      await this.prisma.opexCategory.createMany({
        data: defaultCategories.map((name) => ({ name })),
        skipDuplicates: true,
      });
      return this.prisma.opexCategory.findMany({ orderBy: { name: 'asc' } });
    }
    return categories;
  }

  async createOpexCategory(name: string) {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new BadRequestException('El nombre de la categoria es obligatorio');
    }

    const existingCategory = await this.prisma.opexCategory.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      return existingCategory;
    }

    return this.prisma.opexCategory.create({
      data: {
        name: normalizedName,
      },
    });
  }

  async createOpex(data: {
    amount: number;
    description: string;
    opexCategoryId: string;
    userId: string;
    createdAt?: Date;
  }) {
    const category = await this.prisma.opexCategory.findUnique({
      where: { id: data.opexCategoryId },
    });

    const transaction = await this.prisma.financialTransaction.create({
      data: {
        type: TransactionType.EXPENSE,
        category: category?.name.toLowerCase().includes('nómina')
          ? TransactionCategory.PAYROLL
          : TransactionCategory.OPEX,
        amount: data.amount,
        description: data.description,
        opexCategoryId: data.opexCategoryId,
        userId: data.userId,
        createdAt: data.createdAt || new Date(),
      },
      include: { opexCategory: true, user: true },
    });

    return this.serializeTransactionMoney(transaction);
  }

  async getOpexTransactions() {
    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        category: {
          in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
        },
      },
      include: { opexCategory: true, user: true },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((transaction) =>
      this.serializeTransactionMoney(transaction),
    );
  }

  async getCashFlowData(
    period: 'daily' | 'monthly' = 'monthly',
    startDate?: Date,
    endDate?: Date,
  ) {
    const whereClause: Prisma.FinancialTransactionWhereInput = {};
    const createdAtFilter = this.buildCreatedAtFilter(startDate, endDate);
    if (createdAtFilter) {
      whereClause.createdAt = createdAtFilter;
    }

    let transactions: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.findMany>
    >;

    try {
      transactions = await this.prisma.financialTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      if (this.isMissingFinanceStorageError(error)) {
        return [];
      }

      throw error;
    }

    const flowMap: Record<
      string,
      { income: number; expense: number; date: Date }
    > = {};

    transactions.forEach((tx) => {
      const dateKey = this.getCashFlowDateKey(tx.createdAt, period);

      if (!flowMap[dateKey]) {
        flowMap[dateKey] = { income: 0, expense: 0, date: tx.createdAt };
      }

      const amount = this.toMoneyNumber(tx.amount);

      if (tx.type === TransactionType.INCOME) {
        flowMap[dateKey].income += amount;
      } else {
        flowMap[dateKey].expense += amount;
      }
    });

    const chartData = Object.entries(flowMap).map(([key, data]) => {
      const pointIncome = data.income;
      const pointExpense = data.expense;
      return {
        label: key,
        income: pointIncome,
        expense: pointExpense,
        net: pointIncome - pointExpense,
      };
    });

    // Recalculate cumulative step-by-step for the final array
    let runningBalance = 0;
    const finalData = chartData.map((point) => {
      runningBalance += point.net;
      return {
        ...point,
        balance: runningBalance,
      };
    });

    return finalData;
  }

  async getFinancialSummary(startDate?: Date, endDate?: Date) {
    const whereClause: Prisma.FinancialTransactionWhereInput = {};
    const createdAtFilter = this.buildCreatedAtFilter(startDate, endDate);
    if (createdAtFilter) {
      whereClause.createdAt = createdAtFilter;
    }

    let income: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let opex: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let purchases: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let purchaseReversals: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let transactions: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.findMany>
    >;
    let recentTransactions: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.findMany>
    >;

    try {
      [
        income,
        opex,
        purchases,
        purchaseReversals,
        transactions,
        recentTransactions,
      ] = await Promise.all([
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.INCOME,
            category: TransactionCategory.SALE,
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.EXPENSE,
            category: {
              in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.INCOME,
            category: TransactionCategory.PURCHASE,
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.financialTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
    } catch (error) {
      if (this.isMissingFinanceStorageError(error)) {
        return this.buildEmptyFinancialSummary();
      }

      throw error;
    }

    let totalCOGS: number | null = null;

    try {
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          action: 'REDUCE_STOCK_FIFO',
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
      });

      let cogsAccumulator = 0;
      auditLogs.forEach((log) => {
        cogsAccumulator += this.extractCogsFromPayload(log.payload);
      });
      totalCOGS = auditLogs.length > 0 ? cogsAccumulator : null;
    } catch {
      totalCOGS = null;
    }

    const monthlyData: Record<string, { income: number; expense: number }> = {};
    transactions.forEach((tx) => {
      const month = tx.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };

      const amount = this.toMoneyNumber(tx.amount);

      if (tx.type === TransactionType.INCOME) {
        monthlyData[month].income += amount;
      } else {
        monthlyData[month].expense += amount;
      }
    });

    const cashFlowChart = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));

    return {
      kpis: {
        totalIncome: this.toMoneyNumber(income._sum?.amount),
        totalOpex: this.toMoneyNumber(opex._sum?.amount),
        totalPurchases:
          this.toMoneyNumber(purchases._sum?.amount) -
          this.toMoneyNumber(purchaseReversals?._sum?.amount),
        totalCOGS,
      },
      cashFlowChart,
      recentTransactions: recentTransactions.map((transaction) =>
        this.serializeTransactionMoney(transaction),
      ),
    };
  }

  async getOpexCategoriesSafe() {
    let categories = await this.prisma.opexCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      const defaultCategories = [
        'Nomina',
        'Arriendo',
        'Servicios',
        'Marketing',
        'Mantenimiento',
      ];

      await this.prisma.opexCategory.createMany({
        data: defaultCategories.map((name) => ({ name })),
        skipDuplicates: true,
      });

      categories = await this.prisma.opexCategory.findMany({
        orderBy: { name: 'asc' },
      });
    }

    const mojibakeNomina = categories.find((category) =>
      this.normalizeCategoryName(category.name).includes('na3mina'),
    );

    if (mojibakeNomina) {
      await this.prisma.opexCategory.update({
        where: { id: mojibakeNomina.id },
        data: { name: 'Nomina' },
      });

      categories = await this.prisma.opexCategory.findMany({
        orderBy: { name: 'asc' },
      });
    }

    return categories;
  }

  async createOpexSafe(data: {
    amount: number;
    description: string;
    opexCategoryId: string;
    userId: string;
    createdAt?: Date;
  }) {
    const category = await this.prisma.opexCategory.findUnique({
      where: { id: data.opexCategoryId },
    });

    if (!category) {
      throw new BadRequestException('La categoria de gasto no existe');
    }

    const normalizedCategoryName = this.normalizeCategoryName(category.name);
    const isPayrollCategory =
      normalizedCategoryName.includes('nomina') ||
      normalizedCategoryName.includes('na3mina');

    const transaction = await this.prisma.financialTransaction.create({
      data: {
        type: TransactionType.EXPENSE,
        category: isPayrollCategory
          ? TransactionCategory.PAYROLL
          : TransactionCategory.OPEX,
        amount: data.amount,
        description: data.description,
        opexCategoryId: data.opexCategoryId,
        userId: data.userId,
        createdAt: data.createdAt || new Date(),
      },
      include: { opexCategory: true, user: true },
    });

    return this.serializeTransactionMoney(transaction);
  }

  async getFinancialSummaryLocalized(startDate?: Date, endDate?: Date) {
    const whereClause: Prisma.FinancialTransactionWhereInput = {};
    const createdAtFilter = this.buildCreatedAtFilter(startDate, endDate);
    if (createdAtFilter) {
      whereClause.createdAt = createdAtFilter;
    }

    let income: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let opex: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let purchases: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let purchaseReversals: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.aggregate>
    >;
    let transactions: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.findMany>
    >;
    let recentTransactions: Awaited<
      ReturnType<typeof this.prisma.financialTransaction.findMany>
    >;

    try {
      [
        income,
        opex,
        purchases,
        purchaseReversals,
        transactions,
        recentTransactions,
      ] = await Promise.all([
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.INCOME,
            category: TransactionCategory.SALE,
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.EXPENSE,
            category: {
              in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PURCHASE,
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.aggregate({
          where: {
            ...whereClause,
            type: TransactionType.INCOME,
            category: TransactionCategory.PURCHASE,
          },
          _sum: { amount: true },
        }),
        this.prisma.financialTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.financialTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
    } catch (error) {
      if (this.isMissingFinanceStorageError(error)) {
        return this.buildEmptyFinancialSummary();
      }

      throw error;
    }

    let totalCOGS: number | null = null;

    try {
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          action: 'REDUCE_STOCK_FIFO',
          ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        },
      });

      let cogsAccumulator = 0;
      auditLogs.forEach((log) => {
        cogsAccumulator += this.extractCogsFromPayload(log.payload);
      });
      totalCOGS = auditLogs.length > 0 ? cogsAccumulator : null;
    } catch {
      totalCOGS = null;
    }

    const monthlyData: Record<string, { income: number; expense: number }> = {};
    transactions.forEach((tx) => {
      const month = this.getMonthKey(tx.createdAt);
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }

      const amount = this.toMoneyNumber(tx.amount);

      if (tx.type === TransactionType.INCOME) {
        monthlyData[month].income += amount;
      } else {
        monthlyData[month].expense += amount;
      }
    });

    const cashFlowChart = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));

    return {
      kpis: {
        totalIncome: this.toMoneyNumber(income._sum?.amount),
        totalOpex: this.toMoneyNumber(opex._sum?.amount),
        totalPurchases:
          this.toMoneyNumber(purchases._sum?.amount) -
          this.toMoneyNumber(purchaseReversals?._sum?.amount),
        totalCOGS,
      },
      cashFlowChart,
      recentTransactions: recentTransactions.map((transaction) =>
        this.serializeTransactionMoney(transaction),
      ),
    };
  }
}
