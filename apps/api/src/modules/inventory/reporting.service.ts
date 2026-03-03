import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType, TransactionCategory, BatchStatus } from '../../generated/client/enums';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getClosingReport(startDate: Date, endDate: Date, userId: string) {
    const whereClause = {
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
        ...whereClause,
        action: 'REDUCE_STOCK_FIFO',
      },
    });

    let totalCOGS = 0;
    auditLogs.forEach((log) => {
      const payload = log.payload as any;
      if (payload && payload.quantityReduced && payload.unitCost) {
        totalCOGS += payload.quantityReduced * payload.unitCost;
      }
    });

    // 3. OpEx by Category
    const opexTransactions = await this.prisma.financialTransaction.findMany({
      where: {
        ...whereClause,
        type: TransactionType.EXPENSE,
        category: { in: [TransactionCategory.OPEX, TransactionCategory.PAYROLL] },
      },
      include: { opexCategory: true },
    });

    const opexByCategory: Record<string, number> = {};
    opexTransactions.forEach((tx) => {
      const catName = tx.opexCategory?.name || 'Otros';
      opexByCategory[catName] = (opexByCategory[catName] || 0) + tx.amount;
    });

    // 4. Calculations
    const grossSales = sales._sum.amount || 0;
    const grossProfit = grossSales - totalCOGS;
    const totalOpex = Object.values(opexByCategory).reduce((sum, val) => sum + val, 0);
    const estimatedTaxes = Math.max(0, (grossProfit - totalOpex) * 0.19); // Simplified 19% tax example
    const netProfit = grossProfit - totalOpex - estimatedTaxes;

    // 5. Inventory Valuation (Snapshot of current value)
    const valuation = await this.getInventoryValuation();

    // 6. Audit report generation
    await this.prisma.auditLog.create({
      data: {
        action: 'GENERATE_CLOSING_REPORT',
        entity: 'System',
        userId,
        payload: { startDate, endDate },
      },
    });

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

    return activeBatches.reduce((sum, b) => sum + b.quantityRemaining * b.unitCost, 0);
  }
}
