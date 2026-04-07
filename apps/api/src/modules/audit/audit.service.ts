import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const entityAliases: Record<string, string[]> = {
  Auth: ['Auth', 'auth'],
  B2BQuote: ['B2BQuote', 'b2b'],
  FinancialTransaction: ['FinancialTransaction', 'finance'],
  Order: ['Order', 'orders'],
  PayrollBillingStatement: ['PayrollBillingStatement'],
  PayrollShift: ['PayrollShift'],
  Product: ['Product', 'products'],
  Profile: ['Profile', 'profiles'],
  PurchaseBatch: ['PurchaseBatch', 'batch', 'batches'],
  PqrsTicket: ['PqrsTicket', 'pqrs'],
  Shipment: ['Shipment', 'shipping'],
  ShippingProvider: ['ShippingProvider'],
  Supplier: ['Supplier', 'suppliers'],
  System: ['System'],
  User: ['User', 'users'],
  Variant: ['Variant'],
  WizardOption: ['WizardOption'],
  OpexCategory: ['OpexCategory'],
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    entity?: string;
    action?: string;
    userId?: string;
    skip?: number;
    take?: number;
  }) {
    const { entity, action, userId, skip = 0, take = 50 } = query;
    const entityFilter = entity ? entityAliases[entity] || [entity] : undefined;

    const where = {
      ...(entityFilter && { entity: { in: entityFilter } }),
      ...(action && { action }),
      ...(userId && { userId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: {
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        skip: Number(skip),
        take: Number(take),
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }
}
