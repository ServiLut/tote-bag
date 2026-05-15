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
import { createSimpleXlsxBuffer } from '../../common/utils/simple-xlsx.util';

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
    const rows: Array<Array<string | number | null>> = [
      ['TOTE BAG CO.', null, null],
      ['ESTADO DE RESULTADOS OFICIAL', null, null],
      [
        `Periodo: ${format(startDate, 'dd/MM/yyyy')} - ${format(
          endDate,
          'dd/MM/yyyy',
        )}`,
        null,
        null,
      ],
      [null, null, null],
      ['CONCEPTO', 'TIPO', 'MONTO (COP)'],
      ['Ingresos Operacionales (Ventas)', 'INGRESO', data.totalIncome],
      ['Costo de Ventas (COGS - FIFO)', 'COSTO', -data.totalCOGS],
      ['UTILIDAD BRUTA', 'RESULTADO', data.totalIncome - data.totalCOGS],
      ['Gastos Operativos (OpEx)', 'GASTO', -data.totalOpex],
      ['Impuestos Estimados (19%)', 'IMPUESTO', -data.estimatedTaxes],
      ['UTILIDAD NETA DEL PERIODO', 'FINAL', data.netProfit],
      [null, null, null],
      ['DESGLOSE DE GASTOS DETALLADO', null, null],
      ...Object.entries(data.opexByCategory).map(([category, amount]) => [
        `- ${category}`,
        'OpEx',
        -amount,
      ]),
    ];

    return createSimpleXlsxBuffer('Reporte Contable', rows);

    /*
    // Legacy styled ExcelJS export retained temporarily for reference.
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'TOTE BAG CO.';
    titleCell.font = {
      name: 'Helvetica',
      size: 24,
      bold: true,
      color: { argb: 'FF2D3436' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 40;

    sheet.mergeCells('A2:C2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = 'ESTADO DE RESULTADOS OFICIAL';
    subtitleCell.font = {
      name: 'Helvetica',
      size: 12,
      bold: true,
      color: { argb: 'FF636E72' },
    };
    subtitleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:C3');
    const periodCell = sheet.getCell('A3');
    periodCell.value = `Periodo: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
    periodCell.font = { italic: true, size: 10, color: { argb: 'FFB2BEC3' } };
    periodCell.alignment = { horizontal: 'center' };

    sheet.addRow(['', '', '']); // Spacer

    // Table Headers Style
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2D3436' },
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const sectionHeader = sheet.addRow(['CONCEPTO', 'TIPO', 'MONTO (COP)']);
    sectionHeader.height = 25;
    sectionHeader.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Data rows style
    const currencyFmt = '"$"#,##0;[Red]"-"$#,##0';
    const addStyledRow = (
      label: string,
      type: string,
      value: number,
      options?: { isBold?: boolean; isTotal?: boolean; color?: string },
    ) => {
      const row = sheet.addRow([label, type, value]);
      row.height = 20;
      row.getCell(3).numFmt = currencyFmt;
      row.getCell(1).alignment = { horizontal: 'left', indent: 1 };
      row.getCell(2).alignment = { horizontal: 'center' };

      if (options?.isBold) row.font = { bold: true };
      if (options?.color)
        row.getCell(3).font = { color: { argb: options.color }, bold: true };

      if (options?.isTotal) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          };
          cell.border = {
            top: { style: 'thin' as const, color: { argb: 'FFDCDDE1' } },
            bottom: { style: 'medium' as const, color: { argb: 'FF2D3436' } },
          };
        });
      }
      return row;
    };

    addStyledRow(
      'Ingresos Operacionales (Ventas)',
      'INGRESO',
      data.totalIncome,
    );
    addStyledRow('Costo de Ventas (COGS - FIFO)', 'COSTO', -data.totalCOGS);
    addStyledRow(
      'UTILIDAD BRUTA',
      'RESULTADO',
      data.totalIncome - data.totalCOGS,
      { isBold: true, color: 'FF00B894' },
    );

    addStyledRow('Gastos Operativos (OpEx)', 'GASTO', -data.totalOpex);
    addStyledRow('Impuestos Estimados (19%)', 'IMPUESTO', -data.estimatedTaxes);

    addStyledRow('UTILIDAD NETA DEL PERIODO', 'FINAL', data.netProfit, {
      isBold: true,
      isTotal: true,
      color: data.netProfit >= 0 ? 'FF00B894' : 'FFD63031',
    });

    sheet.addRow(['', '', '']);
    const opexHeader = sheet.addRow(['DESGLOSE DE GASTOS DETALLADO', '', '']);
    opexHeader.height = 25;
    opexHeader.font = { bold: true, size: 12, color: { argb: 'FF2D3436' } };
    sheet.mergeCells(`A${opexHeader.number}:C${opexHeader.number}`);
    opexHeader.getCell(1).alignment = { horizontal: 'left' };
    opexHeader.getCell(1).border = { bottom: { style: 'medium' as const } };

    Object.entries(data.opexByCategory).forEach(([category, amount]) => {
      const r = sheet.addRow([`   • ${category}`, 'OpEx', -amount]);
      r.getCell(3).numFmt = currencyFmt;
      r.getCell(1).font = { color: { argb: 'FF636E72' } };
    });

    sheet.getColumn(1).width = 45;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 25;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
    */
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
        .text('Nit: 900.123.456-1 | Bogotá, Colombia', 50, 70);

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
