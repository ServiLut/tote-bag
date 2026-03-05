import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(lowStockThreshold = 10) {
    // Business timezone for operational KPIs
    const businessTimeZone = 'America/Bogota';
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: businessTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = Number(dateParts.find((p) => p.type === 'year')?.value);
    const month = Number(dateParts.find((p) => p.type === 'month')?.value);
    const day = Number(dateParts.find((p) => p.type === 'day')?.value);

    // Bogota is UTC-05:00 (no DST); convert local midnight to UTC bounds
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [dailyProduction, lowStockCount, pendingQuotes] =
      await this.prisma.$transaction([
        this.prisma.order.count({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        }),
        this.prisma.variant.count({
          where: {
            stock: {
              lt: lowStockThreshold,
            },
            product: {
              isActive: true,
            },
          },
        }),
        this.prisma.b2BQuote.count({
          where: {
            status: {
              not: 'DISEÑO_APROBADO',
            },
          },
        }),
      ]);

    return {
      dailyProduction,
      lowStockCount,
      pendingQuotes,
    };
  }
}
