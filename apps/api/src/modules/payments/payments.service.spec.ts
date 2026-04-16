import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PaymentsService } from './payments.service';
import { WompiEvent } from './interfaces/wompi-event.interface';

describe('PaymentsService', () => {
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  const shippingSyncService = {
    ensureShipmentForOrder: jest.fn(),
  };

  const ordersService = {
    confirmPendingOrderPayment: jest.fn(),
  };

  let service: PaymentsService;

  const buildChecksum = (event: WompiEvent, secret: string) => {
    const base = event.signature.properties
      .map((property: string) =>
        property.split('.').reduce<unknown>((current, segment) => {
          if (
            !current ||
            typeof current !== 'object' ||
            Array.isArray(current)
          ) {
            return undefined;
          }

          return (current as Record<string, unknown>)[segment];
        }, event.data),
      )
      .join('');

    return createHash('sha256')
      .update(`${base}${event.timestamp}${secret}`)
      .digest('hex')
      .toUpperCase();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      configService,
      prisma as never,
      storageService as never,
      shippingSyncService as never,
      ordersService as never,
    );
  });

  it('genera firma con monto en centavos y moneda COP', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      totalAmount: 1234.56,
    });
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WOMPI_INTEGRITY_SECRET') return 'secret';
      if (key === 'WOMPI_PUBLIC_KEY') return 'pub-key';
      return undefined;
    });

    await expect(service.generateSignature('order-1')).resolves.toEqual({
      reference: 'order-1',
      amountInCents: 123456,
      currency: 'COP',
      signature: createHash('sha256')
        .update('order-1123456COPsecret')
        .digest('hex'),
      publicKey: 'pub-key',
    });
  });

  it('rechaza webhook con checksum invalido', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WOMPI_EVENTS_SECRET') return 'events-secret';
      return undefined;
    });

    const event: WompiEvent = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'txn-1',
          created_at: '2026-03-24T00:00:00.000Z',
          amount_in_cents: 3500000,
          reference: 'order-1',
          status: 'APPROVED',
          currency: 'COP',
          payment_method_type: 'CARD',
          status_message: null,
          redirect_url: null,
          payment_source_id: null,
          payment_link_id: null,
          bill_id: null,
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status'],
        checksum: 'INVALID',
      },
      timestamp: 1710000000,
      environment: 'test',
      sent_at: '2026-03-24T00:00:00.000Z',
    };

    await expect(service.handleWompiEvent(event)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('procesa webhook aprobado una sola vez y evita duplicados', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WOMPI_EVENTS_SECRET') return 'events-secret';
      return undefined;
    });

    const event: WompiEvent = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'txn-1',
          created_at: '2026-03-24T00:00:00.000Z',
          amount_in_cents: 3500000,
          reference: 'order-1',
          status: 'APPROVED',
          currency: 'COP',
          payment_method_type: 'CARD',
          status_message: null,
          redirect_url: null,
          payment_source_id: null,
          payment_link_id: null,
          bill_id: null,
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status'],
        checksum: '',
      },
      timestamp: 1710000000,
      environment: 'test',
      sent_at: '2026-03-24T00:00:00.000Z',
    };

    event.signature.checksum = buildChecksum(event, 'events-secret');

    prisma.webhookEvent.findUnique.mockResolvedValueOnce(null);
    prisma.webhookEvent.create.mockResolvedValueOnce({ id: 'webhook-1' });

    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 101,
          totalAmount: 35000,
          status: 'PENDIENTE_PAGO',
        }),
      },
      financialTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'income-1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      webhookEvent: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    ordersService.confirmPendingOrderPayment.mockResolvedValue({
      id: 'order-1',
      orderNumber: 101,
      totalAmount: 35000,
      status: 'PAGADA',
    });

    await expect(service.handleWompiEvent(event)).resolves.toEqual({
      success: true,
    });

    expect(ordersService.confirmPendingOrderPayment).toHaveBeenCalledWith(
      'order-1',
      undefined,
      tx,
    );

    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'webhook-1',
      processed: true,
    });

    await expect(service.handleWompiEvent(event)).resolves.toEqual({
      success: true,
      duplicate: true,
    });
  });

  it('rechaza webhook aprobado cuando el monto no coincide con la orden', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WOMPI_EVENTS_SECRET') return 'events-secret';
      return undefined;
    });

    const event: WompiEvent = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'txn-2',
          created_at: '2026-03-24T00:00:00.000Z',
          amount_in_cents: 1000,
          reference: 'order-2',
          status: 'APPROVED',
          currency: 'COP',
          payment_method_type: 'CARD',
          status_message: null,
          redirect_url: null,
          payment_source_id: null,
          payment_link_id: null,
          bill_id: null,
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status'],
        checksum: '',
      },
      timestamp: 1710000000,
      environment: 'test',
      sent_at: '2026-03-24T00:00:00.000Z',
    };

    event.signature.checksum = buildChecksum(event, 'events-secret');

    prisma.webhookEvent.findUnique.mockResolvedValueOnce(null);
    prisma.webhookEvent.create.mockResolvedValueOnce({ id: 'webhook-2' });

    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-2',
          orderNumber: 102,
          totalAmount: 35_000,
          status: 'PENDIENTE_PAGO',
        }),
      },
      webhookEvent: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(service.handleWompiEvent(event)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ordersService.confirmPendingOrderPayment).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'webhook-2' },
        data: expect.objectContaining({
          status: 'FAILED',
        }) as Record<string, unknown>,
      }),
    );
  });
});
