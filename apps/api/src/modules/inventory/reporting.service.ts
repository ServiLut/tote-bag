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

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

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
    const cell = (value: string | number | null, styleId?: number): SimpleXlsxCell => ({
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
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
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
    <xf numFmtId="0" fontId="0" fillId="1" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="11" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
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

  async getClosingReport(startDate: Date, endDate: Date, _userId: string) {
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
