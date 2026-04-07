import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import {
  TransactionType,
  TransactionCategory,
} from '../../generated/client/enums';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createTransaction(data: {
    type: TransactionType;
    category: TransactionCategory;
    amount: number;
    description: string;
    userId: string;
    purchaseBatchId?: string;
  }) {
    return this.prisma.financialTransaction.create({
      data,
    });
  }

  async getSupplierBalance(supplierId: string) {
    const batches = await this.prisma.purchaseBatch.aggregate({
      where: { supplierId },
      _sum: { totalCost: true },
    });

    const payments = await this.prisma.financialTransaction.aggregate({
      where: {
        supplierId,
        type: TransactionType.EXPENSE,
        category: TransactionCategory.PURCHASE,
      },
      _sum: { amount: true },
    });

    return (batches._sum.totalCost || 0) - (payments._sum.amount || 0);
  }

  async createSupplier(data: {
    name: string;
    nit: string;
    contact?: string;
    phone?: string;
    email?: string;
  }) {
    return this.prisma.supplier.create({ data });
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
        ...s,
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
      ...supplier,
      currentBalance: await this.getSupplierBalance(id),
    };
  }

  async createSupplierPayment(data: {
    supplierId: string;
    amount: number;
    description: string;
    userId: string;
  }) {
    return this.prisma.financialTransaction.create({
      data: {
        type: TransactionType.EXPENSE,
        category: TransactionCategory.PURCHASE,
        amount: data.amount,
        description: data.description,
        supplierId: data.supplierId,
        userId: data.userId,
      },
    });
  }

  async getOpexCategories() {
    const categories = await this.prisma.opexCategory.findMany({
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      // Seed if empty
      const defaultCategories = ['N\u00f3mina', 'Arriendo', 'Servicios', 'Marketing', 'Mantenimiento'];
      await this.prisma.opexCategory.createMany({
        data: defaultCategories.map((name) => ({ name })),
        skipDuplicates: true,
      });
      return this.prisma.opexCategory.findMany({ orderBy: { name: 'asc' } });
    }
    return categories;
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
    const normalizedCategoryName = (category?.name || '')
      .replace(/\u00C3\u00B3/g, 'o')
      .replace(/\u00C3/g, 'a')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return this.prisma.financialTransaction.create({
      data: {
        type: TransactionType.EXPENSE,
        category: normalizedCategoryName.includes('nomina')
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
  }

  async getOpexTransactions() {
    return this.prisma.financialTransaction.findMany({
      where: {
        category: {
          in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
        },
      },
      include: { opexCategory: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCashFlowData(period: 'daily' | 'monthly' = 'monthly') {
    const transactions = await this.prisma.financialTransaction.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const flowMap: Record<
      string,
      { income: number; expense: number; date: Date }
    > = {};

    transactions.forEach((tx) => {
      const dateKey =
        period === 'daily'
          ? tx.createdAt.toISOString().split('T')[0]
          : tx.createdAt.toISOString().substring(0, 7); // YYYY-MM

      if (!flowMap[dateKey]) {
        flowMap[dateKey] = { income: 0, expense: 0, date: tx.createdAt };
      }

      if (tx.type === TransactionType.INCOME) {
        flowMap[dateKey].income += tx.amount;
      } else {
        flowMap[dateKey].expense += tx.amount;
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
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate)
        (whereClause.createdAt as Prisma.DateTimeFilter).gte = startDate;
      if (endDate)
        (whereClause.createdAt as Prisma.DateTimeFilter).lte = endDate;
    }

    // 1. Total Income (Sales)
    const income = await this.prisma.financialTransaction.aggregate({
      where: {
        ...whereClause,
        type: TransactionType.INCOME,
        category: TransactionCategory.SALE,
      },
      _sum: { amount: true },
    });

    // 2. OpEx (Expense with category OPEX or PAYROLL)
    const opex = await this.prisma.financialTransaction.aggregate({
      where: {
        ...whereClause,
        type: TransactionType.EXPENSE,
        category: {
          in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL],
        },
      },
      _sum: { amount: true },
    });

    // 3. Purchase Expenses (Outflow for stock)
    const purchases = await this.prisma.financialTransaction.aggregate({
      where: {
        ...whereClause,
        type: TransactionType.EXPENSE,
        category: TransactionCategory.PURCHASE,
      },
      _sum: { amount: true },
    });

    // 4. Calculate COGS (Realized expense from stock consumption)
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'REDUCE_STOCK_FIFO',
        createdAt: whereClause.createdAt as Prisma.DateTimeFilter,
      },
    });

    let totalCOGS = 0;
    auditLogs.forEach((log) => {
      const payload = log.payload as {
        unitCost?: number;
        quantityReduced?: number;
      } | null;
      if (payload && payload.quantityReduced) {
        totalCOGS += (payload.unitCost || 0) * payload.quantityReduced;
      }
    });

    // 5. Monthly aggregation for charts
    const transactions = await this.prisma.financialTransaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });

    const monthlyData: Record<string, { income: number; expense: number }> = {};
    transactions.forEach((tx) => {
      const month = tx.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };

      if (tx.type === TransactionType.INCOME) {
        monthlyData[month].income += tx.amount;
      } else {
        monthlyData[month].expense += tx.amount;
      }
    });

    const cashFlowChart = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));

    const recentTransactions = await this.prisma.financialTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      kpis: {
        totalIncome: income._sum.amount || 0,
        totalOpex: opex._sum.amount || 0,
        totalPurchases: purchases._sum.amount || 0,
        totalCOGS: totalCOGS || (purchases._sum.amount || 0) * 0.7, // Fallback placeholder
      },
      cashFlowChart,
      recentTransactions,
    };
  }

  private resolveReportRange(query: {
    startDate?: string;
    endDate?: string;
    month?: string;
    year?: string;
  }) {
    const { startDate, endDate, month, year } = query;

    if (startDate || endDate) {
      return {
        start: startDate ? new Date(`${startDate}T00:00:00`) : undefined,
        end: endDate ? new Date(`${endDate}T23:59:59.999`) : undefined,
        label: `${startDate || 'inicio'} - ${endDate || 'hoy'}`,
      };
    }

    if (month && year) {
      const monthIndex = Number.parseInt(month, 10) - 1;
      const numericYear = Number.parseInt(year, 10);
      const start = new Date(numericYear, monthIndex, 1);
      const end = new Date(numericYear, monthIndex + 1, 0, 23, 59, 59, 999);

      return {
        start,
        end,
        label: format(start, 'MMMM yyyy'),
      };
    }

    if (year) {
      const numericYear = Number.parseInt(year, 10);
      return {
        start: new Date(numericYear, 0, 1),
        end: new Date(numericYear, 11, 31, 23, 59, 59, 999),
        label: year,
      };
    }

    const today = new Date();
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999),
      label: format(today, 'MMMM yyyy'),
    };
  }

  async getFinancialReportPreview(query: {
    startDate?: string;
    endDate?: string;
    month?: string;
    year?: string;
  }) {
    const { start, end, label } = this.resolveReportRange(query);
    const summary = await this.getFinancialSummary(start, end);

    return {
      periodLabel: label,
      generatedAt: new Date().toISOString(),
      ...summary,
    };
  }

  async generateFinancialReportPdf(query: {
    startDate?: string;
    endDate?: string;
    month?: string;
    year?: string;
  }) {
    const preview = await this.getFinancialReportPreview(query);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Reporte financiero', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#555').text(`Periodo: ${preview.periodLabel}`);
      doc.text(`Generado: ${format(new Date(preview.generatedAt), 'dd/MM/yyyy HH:mm')}`);
      doc.moveDown();

      doc.fillColor('#111').fontSize(12).text('Indicadores');
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Ingresos: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(preview.kpis.totalIncome || 0)}`);
      doc.text(`OPEX: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(preview.kpis.totalOpex || 0)}`);
      doc.text(`Compras: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(preview.kpis.totalPurchases || 0)}`);
      doc.text(`COGS: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(preview.kpis.totalCOGS || 0)}`);
      doc.moveDown();

      doc.fontSize(12).text('Flujo de caja');
      doc.moveDown(0.5);
      preview.cashFlowChart.slice(0, 12).forEach((row) => {
        doc.fontSize(10).text(
          `${row.month}: ingresos ${row.income}, egresos ${row.expense}`,
        );
      });

      doc.end();
    });

    return {
      fileName: `financial-report-${Date.now()}.pdf`,
      buffer,
    };
  }
}
