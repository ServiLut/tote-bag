import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import {
  TransactionType,
  TransactionCategory,
  BatchStatus,
} from '../../generated/client/enums';
import Decimal from 'decimal.js';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { decimalToNumber, toDecimal } from '../../common/utils/sales-tax.util';
import {
  createSimpleXlsxBuffer,
  type SimpleXlsxCell,
  type SimpleXlsxOptions,
  type SimpleXlsxRow,
} from '../../common/utils/simple-xlsx.util';
import { InventoryService } from './inventory.service';
import {
  BRANDED_REPORT_STYLES_XML,
  BRANDED_REPORT_STYLE_IDS,
  brandedCell,
  brandedEmptyCells,
  createBrandedFooterRow,
  createBrandedPdfLayout,
  createBrandedReportHeaderMerges,
  createBrandedReportHeaderRows,
  createBrandedSectionMerge,
  createBrandedSectionRow,
  drawBrandedPdfFooter,
  drawBrandedPdfKeyValueRow,
  drawBrandedPdfParagraph,
  drawBrandedPdfSectionTitle,
} from '../../common/utils/report-export-branding.util';

type InventoryBatchReport = {
  id: string;
  lineId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  totalCost: number;
  status: string;
  createdAt: string | Date;
  supplier?: {
    id: string;
    name: string;
  } | null;
};

type InventoryProductReport = {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  totalStock: number;
  stockPhysical?: number;
  stockCommitted?: number;
  stockAvailable?: number;
  totalValuation: number;
  weightedAvgCost: number;
  batches: InventoryBatchReport[];
};

type InventoryMovementReport = {
  id: string;
  reason?: string;
  itemType?: string;
  quantity?: number;
  balanceAfter?: number;
  createdAt: string | Date;
  variant?: {
    sku?: string | null;
    product?: { name?: string | null } | null;
  } | null;
  supplyItem?: {
    name?: string | null;
    sku?: string | null;
  } | null;
};

type ReorderAlertReport = {
  itemType: 'VARIANT' | 'SUPPLY';
  id: string;
  sku?: string | null;
  name: string;
  stockPhysical: number;
  stockCommitted: number;
  stockAvailable: number;
  reorderPoint: number;
  unitOfMeasure?: string;
};

type ReorderAlertsReport = {
  count: number;
  variants: ReorderAlertReport[];
  supplies: ReorderAlertReport[];
};

type NonCommercialOutputReason =
  | 'GIFT'
  | 'SAMPLE'
  | 'INTERNAL_TEST'
  | 'OPERATIONAL_USE'
  | 'OTHER';

type NonCommercialOutputStatus = 'COMPLETED';

type NonCommercialOutputReport = {
  id: string;
  quantity: number;
  reason: NonCommercialOutputReason;
  notes?: string | null;
  supportUrl?: string | null;
  status: NonCommercialOutputStatus;
  createdAt: string | Date;
  stockBefore?: number | null;
  stockAfter?: number | null;
  variant?: {
    id: string;
    sku?: string | null;
    size?: string | null;
    color?: string | null;
    product?: {
      id: string;
      name?: string | null;
      slug?: string | null;
    } | null;
  } | null;
  user?: {
    id: string;
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

const NON_COMMERCIAL_REASON_LABELS: Record<NonCommercialOutputReason, string> =
  {
    GIFT: 'Regalo',
    SAMPLE: 'Muestra',
    INTERNAL_TEST: 'Prueba interna',
    OPERATIONAL_USE: 'Uso operativo',
    OTHER: 'Otro',
  };

const NON_COMMERCIAL_STATUS_LABELS: Record<NonCommercialOutputStatus, string> =
  {
    COMPLETED: 'Registrada',
  };

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private validateDateRange(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Rango de fechas invalido');
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        'La fecha inicial no puede ser mayor que la fecha final',
      );
    }
  }

  private formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatUnits(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatDateTime(value: string | Date) {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(value));
  }

  private resolveMovementItemLabel(movement: InventoryMovementReport) {
    if (movement.variant?.product?.name || movement.variant?.sku) {
      const productName = movement.variant?.product?.name || 'Variante';
      const sku = movement.variant?.sku ? ` (${movement.variant.sku})` : '';
      return `${productName}${sku}`;
    }

    if (movement.supplyItem?.name || movement.supplyItem?.sku) {
      const supplyName = movement.supplyItem?.name || 'Insumo';
      const sku = movement.supplyItem?.sku
        ? ` (${movement.supplyItem.sku})`
        : '';
      return `${supplyName}${sku}`;
    }

    return 'Movimiento sin referencia';
  }

  private resolveUserLabel(output: NonCommercialOutputReport) {
    const firstName = output.user?.profile?.firstName?.trim();
    const lastName = output.user?.profile?.lastName?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    if (fullName) {
      return fullName;
    }

    const email = output.user?.email?.trim();
    if (!email) {
      return 'Usuario no disponible';
    }

    return email.split('@')[0] || email;
  }

  private resolveVariantLabel(output: NonCommercialOutputReport) {
    const details = [output.variant?.size, output.variant?.color]
      .filter(Boolean)
      .join(' / ');
    const sku = output.variant?.sku || 'SKU no disponible';
    return details ? `${details} | ${sku}` : sku;
  }

  private async getFifoInventoryReportData() {
    const [products, movements, reorderAlerts] = await Promise.all([
      this.inventoryService.getDetailedInventory() as Promise<
        InventoryProductReport[]
      >,
      this.inventoryService.getInventoryMovements() as Promise<
        InventoryMovementReport[]
      >,
      this.inventoryService.getReorderAlerts() as Promise<ReorderAlertsReport>,
    ]);

    const totals = products.reduce(
      (acc, product) => {
        acc.products += 1;
        acc.units += Number(product.totalStock ?? 0);
        acc.committed += Number(product.stockCommitted ?? 0);
        acc.available += Number(
          product.stockAvailable ?? product.totalStock ?? 0,
        );
        acc.valuation += Number(product.totalValuation ?? 0);
        acc.batches += product.batches.length;
        return acc;
      },
      {
        products: 0,
        units: 0,
        committed: 0,
        available: 0,
        valuation: 0,
        batches: 0,
      },
    );

    return {
      generatedAt: new Date(),
      products,
      movements,
      reorderAlerts,
      totals,
    };
  }

  private async getNonCommercialOutputsReportData() {
    const outputs =
      (await this.inventoryService.listNonCommercialOutputs()) as NonCommercialOutputReport[];

    const summary = outputs.reduce(
      (acc, output) => {
        acc.totalRecords += 1;
        acc.totalUnits += Number(output.quantity ?? 0);
        acc.reasons.add(output.reason);
        return acc;
      },
      {
        totalRecords: 0,
        totalUnits: 0,
        reasons: new Set<NonCommercialOutputReason>(),
      },
    );

    return {
      generatedAt: new Date(),
      outputs,
      summary: {
        totalRecords: summary.totalRecords,
        totalUnits: summary.totalUnits,
        activeReasons: summary.reasons.size,
        lastMovementAt: outputs[0]?.createdAt ?? null,
      },
    };
  }

  async getAccountingReport(startDate: Date, endDate: Date) {
    this.validateDateRange(startDate, endDate);

    const whereClause: Prisma.FinancialTransactionWhereInput = {
      createdAt: { gte: startDate, lte: endDate },
    };

    // 1. Income (From Sales transactions)
    const sales = await this.prisma.financialTransaction.aggregate({
      where: {
        ...whereClause,
        type: TransactionType.INCOME,
        category: TransactionCategory.SALE,
      },
      _sum: { amount: true },
    });
    const totalIncome = decimalToNumber(sales._sum.amount);

    // 2. OpEx (EXPENSE transactions grouped by OpexCategory)
    // We also include PURCHASE transactions that have an opexCategoryId (like Materia Prima)
    const opexTransactions = await this.prisma.financialTransaction.findMany({
      where: {
        ...whereClause,
        OR: [
          {
            type: TransactionType.EXPENSE,
            category: {
              in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
            },
          },
          {
            type: {
              in: [TransactionType.EXPENSE, TransactionType.INCOME],
            },
            category: TransactionCategory.PURCHASE,
            opexCategoryId: { not: null },
          },
        ],
      },
      include: { opexCategory: true },
    });

    const opexByCategory: Record<string, number> = {};
    opexTransactions.forEach((tx) => {
      const catName = tx.opexCategory?.name || 'Otros';
      const signedAmount =
        tx.type === TransactionType.INCOME
          ? -decimalToNumber(tx.amount)
          : decimalToNumber(tx.amount);
      opexByCategory[catName] = (opexByCategory[catName] || 0) + signedAmount;
    });
    const totalOpex = Object.values(opexByCategory).reduce(
      (sum, val) => sum + val,
      0,
    );

    // 3. COGS (Sum of total cost from FIFO logs in AuditLog)
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: whereClause.createdAt as Prisma.DateTimeFilter,
        action: 'REDUCE_STOCK_FIFO',
      },
    });

    let totalCOGS = 0;
    auditLogs.forEach((log) => {
      const payload = log.payload as {
        quantityReduced?: number;
        unitCost?: number;
      } | null;
      if (payload && payload.quantityReduced && payload.unitCost) {
        totalCOGS += payload.quantityReduced * payload.unitCost;
      }
    });

    // 4. Calculations
    const grossProfit = totalIncome - totalCOGS;
    const estimatedTaxes = Math.max(0, (grossProfit - totalOpex) * 0.19);
    const netProfit = grossProfit - totalOpex - estimatedTaxes;

    return {
      period: { startDate, endDate },
      totalIncome,
      totalOpex,
      totalCOGS,
      estimatedTaxes,
      netProfit,
      opexByCategory,
    };
  }

  async generateAccountingExcel(
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    this.validateDateRange(startDate, endDate);
    const data = await this.getAccountingReport(startDate, endDate);
    const formatMoney = (amount: number) =>
      new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(amount);
    const cell = (
      value: string | number | null,
      styleId?: number,
    ): SimpleXlsxCell => ({
      value,
      styleId,
    });
    const emptyCells = (count: number, styleId?: number) =>
      Array.from({ length: count }, () => cell(null, styleId));

    const rows: SimpleXlsxRow[] = [
      { height: 12, cells: emptyCells(6) },
      {
        height: 26,
        cells: [
          cell(null, 14),
          cell('TOTE BAG CO.', 2),
          ...emptyCells(2, 1),
          cell('ESTADO DE RESULTADOS', 4),
          cell(null, 1),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 14),
          cell(null, 1),
          ...emptyCells(2, 1),
          cell(`Generado: ${format(new Date(), 'dd/MM/yyyy')}`, 5),
          cell(null, 1),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 14),
          cell('Medellín, Colombia', 3),
          ...emptyCells(2, 1),
          cell(
            `Periodo: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`,
            5,
          ),
          cell(null, 1),
        ],
      },
      { height: 12, cells: emptyCells(6) },
      {
        height: 22,
        cells: [
          cell(null, 0),
          cell('RESUMEN OPERATIVO', 6),
          ...emptyCells(4, 6),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 0),
          cell('Ingresos por Ventas', 7),
          ...emptyCells(2, 7),
          cell(formatMoney(data.totalIncome), 8),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 0),
          cell('Costo de Mercancía (COGS)', 7),
          ...emptyCells(2, 7),
          cell(formatMoney(-data.totalCOGS), 10),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 0),
          cell('UTILIDAD BRUTA', 7),
          ...emptyCells(2, 7),
          cell(formatMoney(data.totalIncome - data.totalCOGS), 9),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 0),
          cell('Gastos de Operación (OpEx)', 7),
          ...emptyCells(2, 7),
          cell(formatMoney(-data.totalOpex), 10),
        ],
      },
      {
        height: 20,
        cells: [
          cell(null, 0),
          cell('Impuestos de Ley Estimados (19%)', 7),
          ...emptyCells(2, 7),
          cell(formatMoney(-data.estimatedTaxes), 10),
        ],
      },
      {
        height: 26,
        cells: [
          cell(null, 0),
          cell('UTILIDAD NETA DEL EJERCICIO', 11),
          ...emptyCells(2, 11),
          cell(formatMoney(data.netProfit), 12),
        ],
      },
      { height: 12, cells: emptyCells(6) },
      {
        height: 22,
        cells: [
          cell(null, 0),
          cell('DESGLOSE DE GASTOS (OPEX)', 6),
          ...emptyCells(4, 6),
        ],
      },
      ...Object.entries(data.opexByCategory).map(
        ([category, amount]): SimpleXlsxRow => ({
          height: 18,
          cells: [
            cell(null, 0),
            cell(category, 7),
            ...emptyCells(2, 7),
            cell(formatMoney(-amount), 10),
          ],
        }),
      ),
      { height: 12, cells: emptyCells(6) },
      {
        height: 28,
        cells: [
          cell(null, 0),
          cell(
            'Documento interno para uso exclusivo de administración. Los valores están sujetos a auditoría externa.',
            13,
          ),
          ...emptyCells(4, 13),
        ],
      },
    ];

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="12">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="24"/><name val="Calibri"/><family val="2"/><color rgb="FF2D3436"/></font>
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF636E72"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF2D3436"/></font>
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF4B5563"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/><family val="2"/><color rgb="FF2D3436"/></font>
    <font><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF636E72"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF111827"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FF00B894"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><color rgb="FFD63031"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/><family val="2"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="9"/><name val="Calibri"/><family val="2"/><color rgb="FF9CA3AF"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8F9FA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2D3436"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border/>
    <border>
      <bottom style="medium"><color rgb="FF2D3436"/></bottom>
    </border>
    <border>
      <bottom style="thin"><color rgb="FFF1F2F6"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="11" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

    const options: SimpleXlsxOptions = {
      columns: [
        { width: 2.2 },
        { width: 36 },
        { width: 10 },
        { width: 10 },
        { width: 16 },
        { width: 18 },
      ],
      merges: [
        { startRow: 2, startCol: 1, endRow: 3, endCol: 3 },
        { startRow: 2, startCol: 4, endRow: 2, endCol: 5 },
        { startRow: 3, startCol: 4, endRow: 3, endCol: 5 },
        { startRow: 4, startCol: 1, endRow: 4, endCol: 3 },
        { startRow: 4, startCol: 4, endRow: 4, endCol: 5 },
        { startRow: 6, startCol: 1, endRow: 6, endCol: 5 },
        ...[7, 8, 9, 10, 11].flatMap((rowNumber) => [
          { startRow: rowNumber, startCol: 1, endRow: rowNumber, endCol: 4 },
          { startRow: rowNumber, startCol: 5, endRow: rowNumber, endCol: 5 },
        ]),
        { startRow: 12, startCol: 1, endRow: 12, endCol: 5 },
        ...Object.keys(data.opexByCategory).flatMap((_, index) => {
          const rowNumber = 14 + index;
          return [
            { startRow: rowNumber, startCol: 1, endRow: rowNumber, endCol: 4 },
            { startRow: rowNumber, startCol: 5, endRow: rowNumber, endCol: 5 },
          ];
        }),
        {
          startRow: 15 + Object.keys(data.opexByCategory).length,
          startCol: 1,
          endRow: 15 + Object.keys(data.opexByCategory).length,
          endCol: 5,
        },
      ],
      stylesXml,
    };

    return createSimpleXlsxBuffer('Reporte Contable', rows, options);
  }

  async generateAccountingPDF(startDate: Date, endDate: Date): Promise<Buffer> {
    this.validateDateRange(startDate, endDate);
    const data = await this.getAccountingReport(startDate, endDate);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'LETTER',
        info: { Title: 'Reporte Contable - Tote Bag Co.' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(new Error(err.message)));

      // Modern Background & Accent
      doc.rect(0, 0, 612, 100).fillColor('#F8F9FA').fill();
      doc.rect(0, 0, 5, 100).fillColor('#2D3436').fill();

      // Header
      doc
        .fillColor('#2D3436')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('TOTE BAG CO.', 50, 40);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#636E72')
        .text('Medellín, Colombia', 50, 70);

      doc
        .fillColor('#2D3436')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('ESTADO DE RESULTADOS', 400, 45, { align: 'right' });
      doc
        .font('Helvetica')
        .text(`Generado: ${format(new Date(), 'dd/MM/yyyy')}`, 400, 60, {
          align: 'right',
        });
      doc.text(
        `Periodo: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`,
        400,
        75,
        { align: 'right' },
      );

      doc.moveDown(5);
      let currentY = 140;
      const startX = 50;

      const drawHeader = (text: string) => {
        doc
          .fillColor('#2D3436')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(text, startX, currentY);
        currentY += 20;
        doc
          .moveTo(startX, currentY)
          .lineTo(550, currentY)
          .strokeColor('#2D3436')
          .lineWidth(1.5)
          .stroke();
        currentY += 15;
      };

      const drawRow = (
        label: string,
        value: number,
        isSubtotal = false,
        isFinal = false,
      ) => {
        if (isFinal) {
          doc
            .rect(startX - 10, currentY - 5, 520, 35)
            .fillColor('#2D3436')
            .fill();
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12);
        } else {
          doc
            .fillColor(isSubtotal ? '#2D3436' : '#636E72')
            .font(isSubtotal ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(10);
        }

        doc.text(label, startX, currentY + 5);

        const currency = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(value);

        if (!isFinal) {
          if (value < 0) doc.fillColor('#D63031');
          else if (isSubtotal) doc.fillColor('#00B894');
        } else {
          doc.fillColor('#FFFFFF');
        }

        doc.text(currency, 400, currentY + 5, { align: 'right', width: 150 });

        currentY += 30;
        if (!isFinal) {
          doc
            .moveTo(startX, currentY - 5)
            .lineTo(550, currentY - 5)
            .strokeColor('#F1F2F6')
            .lineWidth(0.5)
            .stroke();
        }
      };

      drawHeader('RESUMEN OPERATIVO');
      drawRow('Ingresos por Ventas', data.totalIncome);
      drawRow('Costo de Mercancía (COGS)', -data.totalCOGS);
      drawRow('UTILIDAD BRUTA', data.totalIncome - data.totalCOGS, true);

      drawRow('Gastos de Operación (OpEx)', -data.totalOpex);
      drawRow('Impuestos de Ley Estimados (19%)', -data.estimatedTaxes);

      doc.moveDown(1);
      drawRow('UTILIDAD NETA DEL EJERCICIO', data.netProfit, false, true);

      currentY += 20;
      drawHeader('DESGLOSE DE GASTOS (OPEX)');
      Object.entries(data.opexByCategory).forEach(([cat, val]) => {
        drawRow(cat, -val);
      });

      // Signatures or Footer
      const footerY = 700;
      doc
        .fontSize(8)
        .fillColor('#B2BEC3')
        .text(
          'Este reporte es una representación fiel de los movimientos registrados en el sistema bajo la metodología FIFO de inventarios. Documento generado digitalmente.',
          startX,
          footerY,
          { align: 'center', width: 512 },
        );

      doc.end();
    });
  }

  async generateFifoInventoryExcel(): Promise<Buffer> {
    const data = await this.getFifoInventoryReportData();
    const totalColumns = 8;
    const alerts = [
      ...data.reorderAlerts.variants,
      ...data.reorderAlerts.supplies,
    ];
    const rows: SimpleXlsxRow[] = [];
    const merges = [...createBrandedReportHeaderMerges(totalColumns)];

    rows.push(
      ...createBrandedReportHeaderRows({
        title: 'REPORTE INVENTARIO FIFO',
        generatedLabel: `Generado: ${this.formatDateTime(data.generatedAt)}`,
        totalColumns,
      }),
    );

    rows.push(createBrandedSectionRow('RESUMEN GENERAL', totalColumns));
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));
    rows.push({
      height: 22,
      cells: [
        brandedCell(
          'Producto con stock',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Unidades fisicas',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Unidades comprometidas',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Unidades disponibles',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Valor inventario',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell('Lotes activos', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
      ],
    });
    rows.push({
      height: 22,
      cells: [
        brandedCell(data.totals.products, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(data.totals.units, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(data.totals.committed, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(data.totals.available, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(
          this.formatCurrency(data.totals.valuation),
          BRANDED_REPORT_STYLE_IDS.rowValue,
        ),
        brandedCell(data.totals.batches, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.rowValue),
      ],
    });
    rows.push({ height: 12, cells: brandedEmptyCells(totalColumns) });

    rows.push(
      createBrandedSectionRow('ALERTAS DE REABASTECIMIENTO', totalColumns),
    );
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));
    rows.push({
      height: 22,
      cells: [
        brandedCell('Tipo', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Nombre', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('SKU', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Disponible', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Punto reorden', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Unidad', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
      ],
    });

    if (alerts.length === 0) {
      rows.push({
        height: 20,
        cells: [
          brandedCell('Sin alertas activas', BRANDED_REPORT_STYLE_IDS.rowLabel),
          ...brandedEmptyCells(
            totalColumns - 1,
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
        ],
      });
    } else {
      alerts.forEach((alert) => {
        rows.push({
          height: 20,
          cells: [
            brandedCell(
              alert.itemType === 'VARIANT' ? 'Variante' : 'Insumo',
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(alert.name, BRANDED_REPORT_STYLE_IDS.rowLabel),
            brandedCell(alert.sku ?? '-', BRANDED_REPORT_STYLE_IDS.rowLabel),
            brandedCell(
              this.formatUnits(alert.stockAvailable),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              this.formatUnits(alert.reorderPoint),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              alert.unitOfMeasure ?? 'und',
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(null, BRANDED_REPORT_STYLE_IDS.rowLabel),
            brandedCell(null, BRANDED_REPORT_STYLE_IDS.rowLabel),
          ],
        });
      });
    }

    rows.push({ height: 12, cells: brandedEmptyCells(totalColumns) });
    rows.push(createBrandedSectionRow('INVENTARIO ACTUAL', totalColumns));
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));
    rows.push({
      height: 22,
      cells: [
        brandedCell('Producto', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(
          'Slug / Proveedor',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Stock fisico / Fecha',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Comprometido / Recibido',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Disponible / Restante',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Costo ponderado / Unitario',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell(
          'Valor inventario / Total lote',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell('Lotes / Estado', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
      ],
    });

    data.products.forEach((product) => {
      rows.push({
        height: 22,
        cells: [
          brandedCell(product.name, BRANDED_REPORT_STYLE_IDS.rowLabel),
          brandedCell(product.slug, BRANDED_REPORT_STYLE_IDS.rowLabel),
          brandedCell(
            this.formatUnits(product.stockPhysical ?? product.totalStock),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(
            this.formatUnits(product.stockCommitted ?? 0),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(
            this.formatUnits(product.stockAvailable ?? product.totalStock),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(
            this.formatCurrency(product.weightedAvgCost),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(
            this.formatCurrency(product.totalValuation),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(
            product.batches.length,
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
        ],
      });

      product.batches.forEach((batch) => {
        rows.push({
          height: 20,
          cells: [
            brandedCell(
              `  Lote ${batch.id.slice(0, 8)}`,
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              batch.supplier?.name ?? 'Proveedor no disponible',
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              this.formatDateTime(batch.createdAt),
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              this.formatUnits(batch.quantityReceived),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              this.formatUnits(batch.quantityRemaining),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              this.formatCurrency(batch.unitCost),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              this.formatCurrency(batch.totalCost),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(batch.status, BRANDED_REPORT_STYLE_IDS.rowLabel),
          ],
        });
      });
    });

    rows.push({ height: 12, cells: brandedEmptyCells(totalColumns) });
    rows.push(createBrandedSectionRow('MOVIMIENTOS RECIENTES', totalColumns));
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));
    rows.push({
      height: 22,
      cells: [
        brandedCell('Fecha', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Item', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Tipo', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Motivo', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Cantidad', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Saldo posterior', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(null, BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
      ],
    });

    data.movements.forEach((movement) => {
      rows.push({
        height: 20,
        cells: [
          brandedCell(
            this.formatDateTime(movement.createdAt),
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
          brandedCell(
            this.resolveMovementItemLabel(movement),
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
          brandedCell(
            movement.itemType ?? '-',
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
          brandedCell(
            movement.reason ?? '-',
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
          brandedCell(
            this.formatUnits(Number(movement.quantity ?? 0)),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(
            this.formatUnits(Number(movement.balanceAfter ?? 0)),
            BRANDED_REPORT_STYLE_IDS.rowValue,
          ),
          brandedCell(null, BRANDED_REPORT_STYLE_IDS.rowLabel),
          brandedCell(null, BRANDED_REPORT_STYLE_IDS.rowLabel),
        ],
      });
    });

    rows.push({ height: 12, cells: brandedEmptyCells(totalColumns) });
    rows.push(
      createBrandedFooterRow(
        'Documento interno para uso exclusivo de administracion. La valoracion y trazabilidad se calculan con metodologia FIFO.',
        totalColumns,
      ),
    );
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));

    return createSimpleXlsxBuffer('Inventario FIFO', rows, {
      columns: [
        { width: 28 },
        { width: 24 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
        { width: 20 },
        { width: 22 },
        { width: 16 },
      ],
      merges,
      stylesXml: BRANDED_REPORT_STYLES_XML,
    });
  }

  async generateFifoInventoryPDF(): Promise<Buffer> {
    const data = await this.getFifoInventoryReportData();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'LETTER',
        info: { Title: 'Reporte Inventario FIFO - Tote Bag Co.' },
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(new Error(err.message)));
      const layout = createBrandedPdfLayout(doc, {
        title: 'REPORTE INVENTARIO FIFO',
        generatedLabel: `Generado: ${this.formatDateTime(data.generatedAt)}`,
      });

      drawBrandedPdfSectionTitle(layout, 'RESUMEN GENERAL');
      drawBrandedPdfKeyValueRow(
        layout,
        'Productos con stock',
        this.formatUnits(data.totals.products),
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Unidades fisicas',
        this.formatUnits(data.totals.units),
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Unidades comprometidas',
        this.formatUnits(data.totals.committed),
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Unidades disponibles',
        this.formatUnits(data.totals.available),
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Valor total inventario',
        this.formatCurrency(data.totals.valuation),
        { tone: 'positive', emphasized: true },
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Lotes activos',
        this.formatUnits(data.totals.batches),
      );

      drawBrandedPdfSectionTitle(layout, 'ALERTAS DE REABASTECIMIENTO');
      if (data.reorderAlerts.count === 0) {
        drawBrandedPdfParagraph(
          layout,
          'No hay alertas activas de reabastecimiento.',
        );
      } else {
        [
          ...data.reorderAlerts.variants,
          ...data.reorderAlerts.supplies,
        ].forEach((alert) => {
          drawBrandedPdfParagraph(
            layout,
            `${alert.itemType === 'VARIANT' ? 'Variante' : 'Insumo'}: ${alert.name}${
              alert.sku ? ` (${alert.sku})` : ''
            } | Disponible ${this.formatUnits(alert.stockAvailable)} | Reorden ${this.formatUnits(
              alert.reorderPoint,
            )}${alert.unitOfMeasure ? ` ${alert.unitOfMeasure}` : ''}`,
          );
        });
      }

      drawBrandedPdfSectionTitle(layout, 'INVENTARIO ACTUAL');
      if (data.products.length === 0) {
        drawBrandedPdfParagraph(
          layout,
          'No hay productos con lotes activos en inventario.',
        );
      } else {
        data.products.forEach((product) => {
          drawBrandedPdfParagraph(
            layout,
            `${product.name} (${product.slug}) | Disponible ${this.formatUnits(
              product.stockAvailable ?? product.totalStock,
            )} | Comprometido ${this.formatUnits(product.stockCommitted ?? 0)} | Costo ponderado ${this.formatCurrency(
              product.weightedAvgCost,
            )} | Valor ${this.formatCurrency(product.totalValuation)}`,
          );

          product.batches.forEach((batch) => {
            drawBrandedPdfParagraph(
              layout,
              `Lote ${batch.id.slice(0, 8)} | Proveedor ${
                batch.supplier?.name ?? 'Proveedor no disponible'
              } | Fecha ${this.formatDateTime(batch.createdAt)} | Restante ${this.formatUnits(
                batch.quantityRemaining,
              )} | Costo unitario ${this.formatCurrency(batch.unitCost)}`,
            );
          });
        });
      }

      drawBrandedPdfSectionTitle(layout, 'MOVIMIENTOS RECIENTES');
      if (data.movements.length === 0) {
        drawBrandedPdfParagraph(
          layout,
          'No hay movimientos recientes de inventario.',
        );
      } else {
        data.movements.forEach((movement) => {
          drawBrandedPdfParagraph(
            layout,
            `${this.formatDateTime(movement.createdAt)} | ${this.resolveMovementItemLabel(
              movement,
            )} | ${movement.reason ?? 'Sin motivo'} | Cantidad ${this.formatUnits(
              Number(movement.quantity ?? 0),
            )} | Saldo ${this.formatUnits(Number(movement.balanceAfter ?? 0))}`,
          );
        });
      }

      drawBrandedPdfFooter(
        layout,
        'Documento interno para uso exclusivo de administracion. La valoracion y trazabilidad se calculan con metodologia FIFO.',
      );

      doc.end();
    });
  }

  async generateNonCommercialOutputsExcel(): Promise<Buffer> {
    const data = await this.getNonCommercialOutputsReportData();
    const totalColumns = 11;
    const rows: SimpleXlsxRow[] = [];
    const merges = [...createBrandedReportHeaderMerges(totalColumns)];

    rows.push(
      ...createBrandedReportHeaderRows({
        title: 'SALIDAS NO COMERCIALES',
        generatedLabel: `Generado: ${this.formatDateTime(data.generatedAt)}`,
        totalColumns,
      }),
    );

    rows.push(createBrandedSectionRow('RESUMEN GENERAL', totalColumns));
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));
    rows.push({
      height: 22,
      cells: [
        brandedCell('Registros', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell(
          'Unidades descontadas',
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
        brandedCell('Motivos usados', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Ultimo registro', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        ...brandedEmptyCells(
          totalColumns - 4,
          BRANDED_REPORT_STYLE_IDS.darkHeaderLeft,
        ),
      ],
    });
    rows.push({
      height: 22,
      cells: [
        brandedCell(
          data.summary.totalRecords,
          BRANDED_REPORT_STYLE_IDS.rowValue,
        ),
        brandedCell(data.summary.totalUnits, BRANDED_REPORT_STYLE_IDS.rowValue),
        brandedCell(
          data.summary.activeReasons,
          BRANDED_REPORT_STYLE_IDS.rowValue,
        ),
        brandedCell(
          data.summary.lastMovementAt
            ? this.formatDateTime(data.summary.lastMovementAt)
            : 'Sin datos',
          BRANDED_REPORT_STYLE_IDS.rowValue,
        ),
        ...brandedEmptyCells(
          totalColumns - 4,
          BRANDED_REPORT_STYLE_IDS.rowLabel,
        ),
      ],
    });
    rows.push({ height: 12, cells: brandedEmptyCells(totalColumns) });

    rows.push(createBrandedSectionRow('HISTORIAL DE SALIDAS', totalColumns));
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));
    rows.push({
      height: 22,
      cells: [
        brandedCell('Fecha', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Producto', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Variante / SKU', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Cantidad', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Motivo', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Usuario', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Stock antes', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Stock despues', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Estado', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Observacion', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
        brandedCell('Soporte', BRANDED_REPORT_STYLE_IDS.darkHeaderLeft),
      ],
    });

    if (data.outputs.length === 0) {
      rows.push({
        height: 20,
        cells: [
          brandedCell(
            'No hay salidas no comerciales registradas.',
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
          ...brandedEmptyCells(
            totalColumns - 1,
            BRANDED_REPORT_STYLE_IDS.rowLabel,
          ),
        ],
      });
    } else {
      data.outputs.forEach((output) => {
        rows.push({
          height: 20,
          cells: [
            brandedCell(
              this.formatDateTime(output.createdAt),
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              output.variant?.product?.name ?? 'Variante eliminada',
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              this.resolveVariantLabel(output),
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              this.formatUnits(output.quantity),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              NON_COMMERCIAL_REASON_LABELS[output.reason],
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              this.resolveUserLabel(output),
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              this.formatUnits(Number(output.stockBefore ?? 0)),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              this.formatUnits(Number(output.stockAfter ?? 0)),
              BRANDED_REPORT_STYLE_IDS.rowValue,
            ),
            brandedCell(
              NON_COMMERCIAL_STATUS_LABELS[output.status],
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              output.notes?.trim() || 'Sin observacion',
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
            brandedCell(
              output.supportUrl?.trim() || '-',
              BRANDED_REPORT_STYLE_IDS.rowLabel,
            ),
          ],
        });
      });
    }

    rows.push({ height: 12, cells: brandedEmptyCells(totalColumns) });
    rows.push(
      createBrandedFooterRow(
        'Documento interno para uso exclusivo de administracion. Este historial conserva trazabilidad completa de descuentos no comerciales.',
        totalColumns,
      ),
    );
    merges.push(createBrandedSectionMerge(rows.length, totalColumns));

    return createSimpleXlsxBuffer('Salidas no comerciales', rows, {
      columns: [
        { width: 22 },
        { width: 26 },
        { width: 24 },
        { width: 14 },
        { width: 18 },
        { width: 18 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 36 },
        { width: 40 },
      ],
      merges,
      stylesXml: BRANDED_REPORT_STYLES_XML,
    });
  }

  async generateNonCommercialOutputsPDF(): Promise<Buffer> {
    const data = await this.getNonCommercialOutputsReportData();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'LETTER',
        info: { Title: 'Reporte Salidas No Comerciales - Tote Bag Co.' },
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(new Error(err.message)));
      const layout = createBrandedPdfLayout(doc, {
        title: 'SALIDAS NO COMERCIALES',
        generatedLabel: `Generado: ${this.formatDateTime(data.generatedAt)}`,
      });

      drawBrandedPdfSectionTitle(layout, 'RESUMEN GENERAL');
      drawBrandedPdfKeyValueRow(
        layout,
        'Registros',
        this.formatUnits(data.summary.totalRecords),
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Unidades descontadas',
        this.formatUnits(data.summary.totalUnits),
        { tone: 'negative', emphasized: true },
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Motivos usados',
        this.formatUnits(data.summary.activeReasons),
      );
      drawBrandedPdfKeyValueRow(
        layout,
        'Ultimo registro',
        data.summary.lastMovementAt
          ? this.formatDateTime(data.summary.lastMovementAt)
          : 'Sin datos',
      );

      drawBrandedPdfSectionTitle(layout, 'HISTORIAL DE SALIDAS');
      if (data.outputs.length === 0) {
        drawBrandedPdfParagraph(
          layout,
          'No hay salidas no comerciales registradas.',
        );
      } else {
        data.outputs.forEach((output) => {
          drawBrandedPdfParagraph(
            layout,
            `${this.formatDateTime(output.createdAt)} | ${
              output.variant?.product?.name ?? 'Variante eliminada'
            } | ${this.resolveVariantLabel(output)} | Cantidad ${this.formatUnits(
              output.quantity,
            )} | Motivo ${NON_COMMERCIAL_REASON_LABELS[output.reason]} | Usuario ${this.resolveUserLabel(
              output,
            )} | Estado ${NON_COMMERCIAL_STATUS_LABELS[output.status]} | Observacion ${
              output.notes?.trim() || 'Sin observacion'
            }`,
          );
        });
      }

      drawBrandedPdfFooter(
        layout,
        'Documento interno para uso exclusivo de administracion. Este historial conserva trazabilidad completa de descuentos no comerciales.',
      );

      doc.end();
    });
  }

  async getClosingReport(startDate: Date, endDate: Date, _userId: string) {
    void _userId;
    this.validateDateRange(startDate, endDate);

    const whereClause: Prisma.FinancialTransactionWhereInput = {
      createdAt: { gte: startDate, lte: endDate },
    };

    // 1. Gross Sales (Income Transactions with Category SALE)
    const sales = await this.prisma.financialTransaction.aggregate({
      where: {
        ...whereClause,
        type: TransactionType.INCOME,
        category: TransactionCategory.SALE,
      },
      _sum: { amount: true },
    });

    // 2. Cost of Goods Sold (COGS) from FIFO logs
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: whereClause.createdAt as Prisma.DateTimeFilter,
        action: 'REDUCE_STOCK_FIFO',
      },
    });

    let totalCOGS = 0;
    auditLogs.forEach((log) => {
      const payload = log.payload as {
        quantityReduced?: number;
        unitCost?: number;
      } | null;
      if (payload && payload.quantityReduced && payload.unitCost) {
        totalCOGS += payload.quantityReduced * payload.unitCost;
      }
    });

    // 3. OpEx by Category
    const opexTransactions = await this.prisma.financialTransaction.findMany({
      where: {
        ...whereClause,
        OR: [
          {
            type: TransactionType.EXPENSE,
            category: {
              in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
            },
          },
          {
            type: {
              in: [TransactionType.EXPENSE, TransactionType.INCOME],
            },
            category: TransactionCategory.PURCHASE,
            opexCategoryId: { not: null },
          },
        ],
      },
      include: { opexCategory: true },
    });

    const opexByCategory: Record<string, number> = {};
    opexTransactions.forEach((tx) => {
      const catName = tx.opexCategory?.name || 'Otros';
      const signedAmount =
        tx.type === TransactionType.INCOME
          ? -decimalToNumber(tx.amount)
          : decimalToNumber(tx.amount);
      opexByCategory[catName] = (opexByCategory[catName] || 0) + signedAmount;
    });

    // 4. Calculations
    const grossSales = decimalToNumber(sales._sum.amount);
    const grossProfit = grossSales - totalCOGS;
    const totalOpex = Object.values(opexByCategory).reduce(
      (sum, val) => sum + val,
      0,
    );
    const estimatedTaxes = Math.max(0, (grossProfit - totalOpex) * 0.19); // Simplified 19% tax example
    const netProfit = grossProfit - totalOpex - estimatedTaxes;

    // 5. Inventory Valuation (Snapshot of current value)
    const valuation = await this.getInventoryValuation();

    return {
      period: { startDate, endDate },
      pnl: {
        grossSales,
        totalCOGS,
        grossProfit,
        opexByCategory,
        totalOpex,
        estimatedTaxes,
        netProfit,
      },
      inventoryValuation: valuation,
    };
  }

  async getInventoryValuation() {
    const activeBatches = await this.prisma.purchaseBatch.findMany({
      where: {
        status: BatchStatus.IN_STOCK,
        quantityRemaining: { gt: 0 },
      },
    });

    const valuation = activeBatches.reduce(
      (sum, b) => sum.plus(toDecimal(b.unitCost).mul(b.quantityRemaining)),
      new Decimal(0),
    );

    return decimalToNumber(valuation);
  }
}
