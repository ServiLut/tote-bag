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
} from '../../generated/client/enums';
import {
  decimalToNumber,
  DecimalInput,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';
import { BreakEvenSimulationDto } from './dto/break-even-simulation.dto';

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
  totalAmount: number;
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

      const drawMoney = (amount: number) =>
        this.formatCurrency(this.sanitizeCurrencyAmount(amount));
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
    const createdAtFilter = this.buildDateRangeFilter(
      query.startDate,
      query.endDate,
    );
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: this.revenueOrderStatuses },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        status: true,
        createdAt: true,
        totalAmount: true,
        netAmount: true,
        taxTotal: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const taxableBase = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.netAmount)),
      new Decimal(0),
    );
    const taxTotal = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.taxTotal)),
      new Decimal(0),
    );
    const grossTotal = orders.reduce(
      (sum, order) => sum.plus(toDecimal(order.totalAmount)),
      new Decimal(0),
    );

    return {
      orderCount: orders.length,
      taxableBase: decimalToNumber(taxableBase),
      taxTotal: decimalToNumber(taxTotal),
      grossTotal: decimalToNumber(grossTotal),
      reconciliationDifference: decimalToNumber(
        grossTotal.minus(taxableBase.plus(taxTotal)),
      ),
      orders: orders.map((order) => ({
        ...order,
        totalAmount: decimalToNumber(order.totalAmount),
        netAmount: decimalToNumber(order.netAmount),
        taxTotal: decimalToNumber(order.taxTotal),
      })),
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
