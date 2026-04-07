import { BadRequestException } from '@nestjs/common';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  it('rechaza rangos invertidos antes de consultar Prisma', async () => {
    const prisma = {
      financialTransaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      purchaseBatch: {
        findMany: jest.fn(),
      },
    };
    const service = new ReportingService(prisma as never);

    await expect(
      service.getAccountingReport(
        new Date('2026-03-31T00:00:00.000Z'),
        new Date('2026-03-01T23:59:59.999Z'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.financialTransaction.aggregate).not.toHaveBeenCalled();
  });

  it('rechaza fechas invalidas antes de consultar Prisma', async () => {
    const prisma = {
      financialTransaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      purchaseBatch: {
        findMany: jest.fn(),
      },
    };
    const service = new ReportingService(prisma as never);

    await expect(
      service.getClosingReport(
        new Date('invalid'),
        new Date('2026-03-31'),
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.financialTransaction.aggregate).not.toHaveBeenCalled();
  });
});
