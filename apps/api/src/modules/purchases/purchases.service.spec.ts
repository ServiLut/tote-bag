import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/client/client';
import { PurchaseInvoiceStatus } from '../../generated/client/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchasesService } from './purchases.service';

type SupplierLookup = { id: string } | null;
type PurchaseBatchLookup = { id: string; supplierId: string } | null;
type PurchaseInvoiceSnapshot = {
  id: string;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  _count: {
    payments: number;
  };
};
type PurchaseInvoiceLookup = {
  id: string;
  supplierId?: string | null;
  purchaseBatchId?: string | null;
  issueDate?: Date;
  totalAmount: Prisma.Decimal;
  paidAmount?: Prisma.Decimal;
  _count: {
    payments: number;
  };
};
type PurchasePaymentLookup = {
  id: string;
  invoiceId: string;
  amount: Prisma.Decimal;
  paymentDate: Date;
  proofUrl?: string | null;
};
type PurchaseInvoiceCreateArgs = {
  data: {
    totalAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    balanceDue: Prisma.Decimal;
    status: PurchaseInvoiceStatus;
  };
};
type PurchasePaymentCreateArgs = {
  data: {
    amount: Prisma.Decimal;
    proofUrl?: string | null;
  };
};
type PurchaseInvoiceUpdateArgs = {
  data: {
    supplierId?: string | null;
    totalAmount?: Prisma.Decimal;
    issueDate?: Date;
    paidAmount?: Prisma.Decimal;
    balanceDue?: Prisma.Decimal;
    status?: PurchaseInvoiceStatus;
  };
};
type UpdatedInvoiceResult = {
  id: string;
  status: PurchaseInvoiceStatus;
  balanceDue?: Prisma.Decimal;
};
type PaymentResult = {
  id: string;
};
type TransactionMock = {
  purchaseInvoice: {
    findUnique: jest.Mock<
      Promise<PurchaseInvoiceSnapshot | PurchaseInvoiceLookup | null>,
      [unknown]
    >;
    update: jest.Mock<Promise<UpdatedInvoiceResult>, [unknown]>;
  };
  purchasePayment: {
    create: jest.Mock<Promise<PaymentResult>, [unknown]>;
    findUnique: jest.Mock<Promise<PurchasePaymentLookup | null>, [unknown]>;
    update: jest.Mock<Promise<PaymentResult>, [unknown]>;
    aggregate: jest.Mock<
      Promise<{ _sum: { amount: Prisma.Decimal | null } }>,
      [unknown]
    >;
  };
};

describe('PurchasesService', () => {
  const prisma = {
    supplier: {
      findUnique: jest.fn<Promise<SupplierLookup>, [unknown]>(),
    },
    purchaseBatch: {
      findUnique: jest.fn<Promise<PurchaseBatchLookup>, [unknown]>(),
    },
    purchaseInvoice: {
      create: jest.fn<Promise<{ id: string }>, [unknown]>(),
      findMany: jest.fn<Promise<unknown[]>, [unknown]>(),
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
      delete: jest.fn<Promise<unknown>, [unknown]>(),
    },
    $transaction: jest.fn<Promise<unknown>, [unknown]>(),
  };

  let service: PurchasesService;

  function createInvoiceLookupMock(snapshot: PurchaseInvoiceSnapshot | null) {
    return jest
      .fn<Promise<PurchaseInvoiceSnapshot | null>, [unknown]>()
      .mockResolvedValue(snapshot);
  }

  function createInvoiceUpdateMock(result: UpdatedInvoiceResult) {
    return jest
      .fn<Promise<UpdatedInvoiceResult>, [unknown]>()
      .mockResolvedValue(result);
  }

  function createPaymentMock(result: PaymentResult = { id: 'payment-1' }) {
    return jest
      .fn<Promise<PaymentResult>, [unknown]>()
      .mockResolvedValue(result);
  }

  function createPaymentLookupMock(snapshot: PurchasePaymentLookup | null) {
    return jest
      .fn<Promise<PurchasePaymentLookup | null>, [unknown]>()
      .mockResolvedValue(snapshot);
  }

  function createPaymentUpdateMock(
    result: PaymentResult = { id: 'payment-1' },
  ) {
    return jest
      .fn<Promise<PaymentResult>, [unknown]>()
      .mockResolvedValue(result);
  }

  function createPaymentAggregateMock(amount: Prisma.Decimal | null) {
    return jest
      .fn<Promise<{ _sum: { amount: Prisma.Decimal | null } }>, [unknown]>()
      .mockResolvedValue({
        _sum: {
          amount,
        },
      });
  }

  function mockTransaction(tx: TransactionMock) {
    prisma.$transaction.mockImplementation(
      (callback: (client: TransactionMock) => Promise<unknown>) => callback(tx),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    service = new PurchasesService(prisma as unknown as PrismaService);
  });

  it('creates invoices with pending status and derived balance', async () => {
    prisma.purchaseInvoice.create.mockResolvedValue({ id: 'invoice-1' });
    prisma.supplier.findUnique.mockResolvedValue({ id: 'supplier-1' });

    await service.createPurchaseInvoice({
      totalAmount: '1250.50',
      issueDate: '2026-04-09T00:00:00.000Z',
      supplierId: 'supplier-1',
    });

    expect(prisma.purchaseInvoice.create).toHaveBeenCalledTimes(1);
    const [createArgs] = prisma.purchaseInvoice.create.mock.calls[0] as [
      PurchaseInvoiceCreateArgs,
    ];

    expect(
      createArgs.data.totalAmount.equals(new Prisma.Decimal('1250.50')),
    ).toBe(true);
    expect(createArgs.data.paidAmount.equals(new Prisma.Decimal(0))).toBe(true);
    expect(
      createArgs.data.balanceDue.equals(new Prisma.Decimal('1250.50')),
    ).toBe(true);
    expect(createArgs.data.status).toBe(PurchaseInvoiceStatus.PENDING);
  });

  it('requires a supplier or purchase batch to create invoices', async () => {
    await expect(
      service.createPurchaseInvoice({
        totalAmount: '1250.50',
        issueDate: '2026-04-09T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects supplier and batch mismatches', async () => {
    prisma.supplier.findUnique.mockResolvedValue({ id: 'supplier-1' });
    prisma.purchaseBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      supplierId: 'supplier-2',
    });

    await expect(
      service.createPurchaseInvoice({
        totalAmount: '100',
        issueDate: '2026-04-09T00:00:00.000Z',
        supplierId: 'supplier-1',
        purchaseBatchId: 'batch-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates invoice totals and recalculates balance', async () => {
    prisma.purchaseInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      supplierId: 'supplier-1',
      purchaseBatchId: null,
      issueDate: new Date('2026-04-09T00:00:00.000Z'),
      totalAmount: new Prisma.Decimal('100'),
      paidAmount: new Prisma.Decimal('30'),
      _count: {
        payments: 1,
      },
    });
    prisma.supplier.findUnique.mockResolvedValue({ id: 'supplier-2' });
    prisma.purchaseInvoice.update.mockResolvedValue({
      id: 'invoice-1',
      status: PurchaseInvoiceStatus.PARTIAL,
    });

    await service.updatePurchaseInvoice('invoice-1', {
      supplierId: 'supplier-2',
      totalAmount: '150',
      issueDate: '2026-04-10T00:00:00.000Z',
    });

    expect(prisma.purchaseInvoice.update).toHaveBeenCalledTimes(1);
    const [updateArgs] = prisma.purchaseInvoice.update.mock.calls[0] as [
      PurchaseInvoiceUpdateArgs,
    ];

    expect(updateArgs.data.supplierId).toBe('supplier-2');
    expect(updateArgs.data.totalAmount?.equals(new Prisma.Decimal('150'))).toBe(
      true,
    );
    expect(updateArgs.data.balanceDue?.equals(new Prisma.Decimal('120'))).toBe(
      true,
    );
    expect(updateArgs.data.status).toBe(PurchaseInvoiceStatus.PARTIAL);
  });

  it('rejects invoice updates below already paid amount', async () => {
    prisma.purchaseInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      supplierId: 'supplier-1',
      purchaseBatchId: null,
      issueDate: new Date('2026-04-09T00:00:00.000Z'),
      totalAmount: new Prisma.Decimal('100'),
      paidAmount: new Prisma.Decimal('60'),
      _count: {
        payments: 1,
      },
    });
    prisma.supplier.findUnique.mockResolvedValue({ id: 'supplier-1' });

    await expect(
      service.updatePurchaseInvoice('invoice-1', {
        totalAmount: '50',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.purchaseInvoice.update).not.toHaveBeenCalled();
  });

  it('rejects deleting invoices with payments', async () => {
    prisma.purchaseInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      _count: {
        payments: 1,
      },
    });

    await expect(
      service.deletePurchaseInvoice('invoice-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.purchaseInvoice.delete).not.toHaveBeenCalled();
    expect(prisma.purchaseInvoice.update).not.toHaveBeenCalled();
  });

  it('soft-deletes invoices without payments', async () => {
    prisma.purchaseInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      _count: {
        payments: 0,
      },
    });
    prisma.purchaseInvoice.update.mockResolvedValue({ id: 'invoice-1' });

    await service.deletePurchaseInvoice('invoice-1');

    expect(prisma.purchaseInvoice.delete).not.toHaveBeenCalled();
    expect(prisma.purchaseInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { deletedAt: expect.any(Date) as unknown },
    });
  });

  it('rejects payments against missing invoices', async () => {
    mockTransaction({
      purchaseInvoice: {
        findUnique: createInvoiceLookupMock(null),
        update: createInvoiceUpdateMock({
          id: 'invoice-404',
          status: PurchaseInvoiceStatus.PENDING,
        }),
      },
      purchasePayment: {
        create: createPaymentMock(),
        findUnique: createPaymentLookupMock(null),
        update: createPaymentUpdateMock(),
        aggregate: createPaymentAggregateMock(null),
      },
    });

    await expect(
      service.registerPurchaseInvoicePayment('invoice-404', {
        amount: '50',
        paymentDate: '2026-04-09T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates invoice status to paid when balance reaches zero', async () => {
    const createPayment = createPaymentMock();
    const updateInvoice = createInvoiceUpdateMock({
      id: 'invoice-1',
      status: PurchaseInvoiceStatus.PAID,
    });

    mockTransaction({
      purchaseInvoice: {
        findUnique: createInvoiceLookupMock({
          id: 'invoice-1',
          totalAmount: new Prisma.Decimal('100'),
          paidAmount: new Prisma.Decimal('40'),
          balanceDue: new Prisma.Decimal('60'),
          _count: {
            payments: 1,
          },
        }),
        update: updateInvoice,
      },
      purchasePayment: {
        create: createPayment,
        findUnique: createPaymentLookupMock(null),
        update: createPaymentUpdateMock(),
        aggregate: createPaymentAggregateMock(null),
      },
    });

    const result = await service.registerPurchaseInvoicePayment('invoice-1', {
      amount: '60',
      paymentDate: '2026-04-09T00:00:00.000Z',
      proofUrl: 'private://support-documents/receipts/purchase-payment/proof.pdf',
    });

    expect(createPayment).toHaveBeenCalledTimes(1);
    const [paymentArgs] = createPayment.mock.calls[0] as [
      PurchasePaymentCreateArgs,
    ];
    expect(paymentArgs.data.amount.equals(new Prisma.Decimal('60'))).toBe(true);
    expect(paymentArgs.data.proofUrl).toBe(
      'private://support-documents/receipts/purchase-payment/proof.pdf',
    );

    expect(updateInvoice).toHaveBeenCalledTimes(1);
    const [updateArgs] = updateInvoice.mock.calls[0] as [
      PurchaseInvoiceUpdateArgs,
    ];
    expect(updateArgs.data.paidAmount?.equals(new Prisma.Decimal('100'))).toBe(
      true,
    );
    expect(updateArgs.data.balanceDue?.equals(new Prisma.Decimal('0'))).toBe(
      true,
    );
    expect(updateArgs.data.status).toBe(PurchaseInvoiceStatus.PAID);
    expect(result.invoice.status).toBe(PurchaseInvoiceStatus.PAID);
  });

  it('updates invoice status to partial when there is remaining balance', async () => {
    const updateInvoice = createInvoiceUpdateMock({
      id: 'invoice-1',
      status: PurchaseInvoiceStatus.PARTIAL,
      balanceDue: new Prisma.Decimal('70'),
    });

    mockTransaction({
      purchaseInvoice: {
        findUnique: createInvoiceLookupMock({
          id: 'invoice-1',
          totalAmount: new Prisma.Decimal('100'),
          paidAmount: new Prisma.Decimal('0'),
          balanceDue: new Prisma.Decimal('100'),
          _count: {
            payments: 0,
          },
        }),
        update: updateInvoice,
      },
      purchasePayment: {
        create: createPaymentMock(),
        findUnique: createPaymentLookupMock(null),
        update: createPaymentUpdateMock(),
        aggregate: createPaymentAggregateMock(null),
      },
    });

    const result = await service.registerPurchaseInvoicePayment('invoice-1', {
      amount: '30',
      paymentDate: '2026-04-09T00:00:00.000Z',
    });

    expect(updateInvoice).toHaveBeenCalledTimes(1);
    const [updateArgs] = updateInvoice.mock.calls[0] as [
      PurchaseInvoiceUpdateArgs,
    ];
    expect(updateArgs.data.paidAmount?.equals(new Prisma.Decimal('30'))).toBe(
      true,
    );
    expect(updateArgs.data.balanceDue?.equals(new Prisma.Decimal('70'))).toBe(
      true,
    );
    expect(updateArgs.data.status).toBe(PurchaseInvoiceStatus.PARTIAL);
    expect(result.invoice.status).toBe(PurchaseInvoiceStatus.PARTIAL);
  });

  it('rejects overpayments', async () => {
    const createPayment = jest.fn<Promise<PaymentResult>, [unknown]>();

    mockTransaction({
      purchaseInvoice: {
        findUnique: createInvoiceLookupMock({
          id: 'invoice-1',
          totalAmount: new Prisma.Decimal('100'),
          paidAmount: new Prisma.Decimal('10'),
          balanceDue: new Prisma.Decimal('90'),
          _count: {
            payments: 1,
          },
        }),
        update: createInvoiceUpdateMock({
          id: 'invoice-1',
          status: PurchaseInvoiceStatus.PARTIAL,
        }),
      },
      purchasePayment: {
        create: createPayment,
        findUnique: createPaymentLookupMock(null),
        update: createPaymentUpdateMock(),
        aggregate: createPaymentAggregateMock(null),
      },
    });

    await expect(
      service.registerPurchaseInvoicePayment('invoice-1', {
        amount: '91',
        paymentDate: '2026-04-09T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createPayment).not.toHaveBeenCalled();
  });

  it('rejects payments that would leave a negative balance', async () => {
    const createPayment = jest.fn<Promise<PaymentResult>, [unknown]>();

    mockTransaction({
      purchaseInvoice: {
        findUnique: createInvoiceLookupMock({
          id: 'invoice-1',
          totalAmount: new Prisma.Decimal('100'),
          paidAmount: new Prisma.Decimal('99.90'),
          balanceDue: new Prisma.Decimal('0.20'),
          _count: {
            payments: 1,
          },
        }),
        update: createInvoiceUpdateMock({
          id: 'invoice-1',
          status: PurchaseInvoiceStatus.PARTIAL,
        }),
      },
      purchasePayment: {
        create: createPayment,
        findUnique: createPaymentLookupMock(null),
        update: createPaymentUpdateMock(),
        aggregate: createPaymentAggregateMock(null),
      },
    });

    await expect(
      service.registerPurchaseInvoicePayment('invoice-1', {
        amount: '0.20',
        paymentDate: '2026-04-09T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createPayment).not.toHaveBeenCalled();
  });

  it('updates an existing payment and recalculates the invoice totals', async () => {
    const updatePayment = createPaymentUpdateMock({ id: 'payment-1' });
    const updateInvoice = createInvoiceUpdateMock({
      id: 'invoice-1',
      status: PurchaseInvoiceStatus.PAID,
      balanceDue: new Prisma.Decimal('0'),
    });

    mockTransaction({
      purchaseInvoice: {
        findUnique: jest
          .fn<Promise<PurchaseInvoiceLookup | null>, [unknown]>()
          .mockResolvedValue({
            id: 'invoice-1',
            totalAmount: new Prisma.Decimal('100'),
            _count: {
              payments: 2,
            },
          }),
        update: updateInvoice,
      },
      purchasePayment: {
        create: createPaymentMock(),
        findUnique: createPaymentLookupMock({
          id: 'payment-1',
          invoiceId: 'invoice-1',
          amount: new Prisma.Decimal('20'),
          paymentDate: new Date('2026-04-09T00:00:00.000Z'),
          proofUrl: null,
        }),
        update: updatePayment,
        aggregate: createPaymentAggregateMock(new Prisma.Decimal('60')),
      },
    });

    const result = await service.updatePurchaseInvoicePayment(
      'invoice-1',
      'payment-1',
      {
        amount: '40',
        proofUrl: 'private://support-documents/receipts/purchase-payment/new-proof.pdf',
      },
    );

    expect(updatePayment).toHaveBeenCalledTimes(1);
    expect(updateInvoice).toHaveBeenCalledTimes(1);
    const [updateArgs] = updateInvoice.mock.calls[0] as [
      PurchaseInvoiceUpdateArgs,
    ];
    expect(updateArgs.data.paidAmount?.equals(new Prisma.Decimal('100'))).toBe(
      true,
    );
    expect(updateArgs.data.balanceDue?.equals(new Prisma.Decimal('0'))).toBe(
      true,
    );
    expect(updateArgs.data.status).toBe(PurchaseInvoiceStatus.PAID);
    expect(result.invoice.status).toBe(PurchaseInvoiceStatus.PAID);
  });
});
