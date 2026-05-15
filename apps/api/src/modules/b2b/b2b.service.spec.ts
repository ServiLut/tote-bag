import { BadRequestException } from '@nestjs/common';
import {
  B2BQuoteItemType,
  B2BReservationStatus,
} from '../../generated/client/enums';
import { B2bService } from './b2b.service';
import {
  B2BQuoteItemTypeInput,
  CreateQuoteDto,
  QrType,
} from './dto/create-quote.dto';

describe('B2bService', () => {
  type DataMock = { mock: { calls: Array<Array<unknown>> } };
  const createdItems: Array<Record<string, unknown>> = [];

  const tx = {
    b2BQuote: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    b2BQuoteItem: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(),
    b2BQuote: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn(),
  };

  const pricingService = {
    calculateQuote: jest.fn(),
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  const inventoryService = {
    commitStock: jest.fn(),
    releaseCommittedStock: jest.fn(),
  };

  let service: B2bService;

  beforeEach(() => {
    jest.clearAllMocks();
    createdItems.length = 0;

    configService.get.mockImplementation((key: string) => {
      if (key === 'B2B_QUOTE_RESERVATION_HOURS') return 48;
      return undefined;
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    tx.b2BQuote.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'quote-1', ...data }),
    );
    tx.b2BQuoteItem.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const item = { id: `item-${createdItems.length + 1}`, ...data };
        createdItems.push(item);
        return Promise.resolve(item);
      },
    );
    tx.b2BQuoteItem.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const item = createdItems.find((entry) => entry.id === where.id);
        Object.assign(item ?? {}, data);
        return Promise.resolve({ id: where.id, ...data });
      },
    );
    tx.b2BQuote.findUniqueOrThrow.mockImplementation(() =>
      Promise.resolve({ id: 'quote-1', items: createdItems }),
    );
    inventoryService.commitStock.mockResolvedValue({
      stockPhysical: 100,
      stockCommitted: 10,
      stockAvailable: 90,
    });
    inventoryService.releaseCommittedStock.mockResolvedValue({
      stockPhysical: 100,
      stockCommitted: 0,
      stockAvailable: 100,
    });

    service = new B2bService(
      prisma as never,
      configService as never,
      pricingService as never,
      storageService as never,
      inventoryService as never,
    );
  });

  function baseQuote(items: CreateQuoteDto['items']): CreateQuoteDto {
    return {
      quantity: 50,
      department: 'Antioquia',
      municipality: 'Medellin',
      neighborhood: 'Centro',
      address: 'Calle 1',
      qrType: QrType.WHATSAPP,
      qrData: '573000000000',
      businessName: 'Cliente B2B',
      contactPhone: '573000000000',
      items,
    };
  }

  function firstDataArg(mock: DataMock): Record<string, unknown> {
    const firstArg = mock.mock.calls[0]?.[0] as
      | { data?: Record<string, unknown> }
      | undefined;

    return firstArg?.data ?? {};
  }

  function callArg(
    mock: { mock: { calls: Array<Array<unknown>> } },
    index: number,
  ) {
    return mock.mock.calls[0]?.[index];
  }

  it('stores manual external production details without reserving stock', async () => {
    const result = await service.createQuote(
      baseQuote([
        {
          productId: 'product-1',
          quantity: 50,
          itemType: B2BQuoteItemTypeInput.MANUAL_EXTERNAL_PRODUCTION,
          manualSize: '42x35x12 cm',
          manualSpecs: { gusset: '12 cm' },
          externalUnitCost: 12000,
          agreedUnitPrice: 18000,
        },
      ]),
    );

    expect(result.success).toBe(true);
    expect(inventoryService.commitStock).not.toHaveBeenCalled();
    expect(firstDataArg(tx.b2BQuote.create)).toMatchObject({
      reservationStatus: B2BReservationStatus.NONE,
      expiresAt: null,
    });
    expect(firstDataArg(tx.b2BQuoteItem.create)).toMatchObject({
      itemType: B2BQuoteItemType.MANUAL_EXTERNAL_PRODUCTION,
      manualSize: '42x35x12 cm',
      manualSpecs: { gusset: '12 cm' },
      externalUnitCost: 12000,
      agreedUnitPrice: 18000,
      unitPrice: 18000,
      totalPrice: 900000,
      reservedQuantity: 0,
    });
  });

  it('rejects manual quote details when the caller is not allowed to create manual items', async () => {
    await expect(
      service.createQuote(
        baseQuote([
          {
            productId: 'product-1',
            quantity: 50,
            itemType: B2BQuoteItemTypeInput.MANUAL_EXTERNAL_PRODUCTION,
            externalUnitCost: 12000,
            agreedUnitPrice: 18000,
          },
        ]),
        undefined,
        { allowManualItems: false },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.b2BQuote.create).not.toHaveBeenCalled();
    expect(inventoryService.commitStock).not.toHaveBeenCalled();
  });

  it('commits stock temporarily for standard items with a variant', async () => {
    await service.createQuote({
      ...baseQuote([
        {
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 50,
          reserveStock: true,
        },
      ]),
      reservationHours: 12,
    });

    const quoteData = firstDataArg(tx.b2BQuote.create);
    expect(quoteData).toMatchObject({
      reservationStatus: B2BReservationStatus.ACTIVE,
      reservationHours: 12,
    });
    expect(quoteData.expiresAt).toBeInstanceOf(Date);
    expect(inventoryService.commitStock).toHaveBeenCalledWith(
      'variant-1',
      50,
      undefined,
      undefined,
      tx,
      expect.any(Object),
    );
    const commitmentMetadata = callArg(inventoryService.commitStock, 5) as
      | Record<string, unknown>
      | undefined;
    expect(commitmentMetadata).toMatchObject({
      source: 'B2B_QUOTE',
      quoteId: 'quote-1',
      quoteItemId: 'item-1',
    });
    expect(typeof commitmentMetadata?.reservationExpiresAt).toBe('string');
    const itemData = firstDataArg(tx.b2BQuoteItem.create);
    expect(itemData).toMatchObject({
      variantId: 'variant-1',
      itemType: B2BQuoteItemType.STANDARD_STOCK,
      reservedQuantity: 50,
    });
    expect(itemData.reservationExpiresAt).toBeInstanceOf(Date);
  });

  it('releases reserved stock when active quotes expire', async () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    tx.b2BQuote.findMany.mockResolvedValue([
      {
        id: 'quote-1',
        items: [
          {
            id: 'item-1',
            variantId: 'variant-1',
            reservedQuantity: 50,
          },
        ],
      },
    ]);
    tx.b2BQuote.update.mockResolvedValue({});

    const result = await service.expireActiveReservations(now);

    expect(result).toEqual({ expiredCount: 1 });
    expect(inventoryService.releaseCommittedStock).toHaveBeenCalledWith(
      'variant-1',
      50,
      undefined,
      undefined,
      tx,
      {
        source: 'B2B_QUOTE',
        quoteId: 'quote-1',
        quoteItemId: 'item-1',
        reservationReleasedAt: now.toISOString(),
      },
    );
    expect(tx.b2BQuoteItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { reservationReleasedAt: now },
    });
    expect(tx.b2BQuote.update).toHaveBeenCalledWith({
      where: { id: 'quote-1' },
      data: {
        reservationStatus: B2BReservationStatus.EXPIRED,
        reservationReleasedAt: now,
      },
    });
  });

  it('normalizes approved design statuses for dashboard listings', async () => {
    prisma.b2BQuote.findMany.mockResolvedValue([
      { id: 'quote-1', status: 'DISEÃ‘O_APROBADO', items: [] },
      { id: 'quote-2', status: 'PENDIENTE', items: [] },
    ]);

    const result = await service.findAllDashboard();

    expect(result).toEqual([
      expect.objectContaining({
        id: 'quote-1',
        status: 'DISE\u00d1O_APROBADO',
      }),
      expect.objectContaining({
        id: 'quote-2',
        status: 'PENDIENTE',
      }),
    ]);
  });

  it('stores the canonical approved design status when approving from dashboard', async () => {
    prisma.b2BQuote.update.mockResolvedValue({
      id: 'quote-1',
      status: 'DISE\u00d1O_APROBADO',
    });

    await service.approveDesignDashboard('quote-1');

    expect(prisma.b2BQuote.update).toHaveBeenCalledWith({
      where: { id: 'quote-1' },
      data: { status: 'DISE\u00d1O_APROBADO' },
    });
  });
});
