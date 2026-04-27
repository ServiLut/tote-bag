import { BadRequestException } from '@nestjs/common';
import { PersonalizationRequestStatus } from '../../generated/client/enums';
import { PersonalizationsService } from './personalizations.service';

describe('PersonalizationsService', () => {
  const prisma = {
    personalizationRequest: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  const pricingService = {};

  const ordersService = {
    create: jest.fn(),
  };

  const service = new PersonalizationsService(
    prisma as any,
    storageService as any,
    pricingService as any,
    ordersService as any,
  );

  const receiptFile = {
    originalname: 'comprobante.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('receipt'),
  } as Express.Multer.File;

  const baseRequest = {
    id: 'request-1',
    status: PersonalizationRequestStatus.PENDING,
    profileId: 'profile-1',
    productId: 'product-1',
    variantId: 'variant-1',
    quantity: 12,
    line: 'CORPORATIVA',
    size: 'Mediana',
    material: 'Lona',
    quality: null,
    configCode: 'CFG-123',
    currency: 'COP',
    designUrl: 'https://cdn.example.com/custom-designs/logo.png',
    personalizations: [],
    configurationJson: {
      customImageURL: 'https://cdn.example.com/custom-designs/logo.png',
    },
    product: {
      id: 'product-1',
      name: 'Tote Bag Clasica',
      slug: 'tote-bag-clasica',
    },
    variant: {
      id: 'variant-1',
      sku: 'SKU-001',
    },
    user: {
      id: 'user-1',
      email: 'cliente@example.com',
    },
    profile: {
      id: 'profile-1',
      firstName: 'Ana',
      lastName: 'Cliente',
      phone: '3000000000',
      email: 'cliente@example.com',
      department: 'Antioquia',
      municipality: 'Medellin',
      neighborhood: 'Laureles',
      address: 'Calle 10 # 20-30',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exige comprobante para aprobar una solicitud', async () => {
    await expect(
      service.approveRequest('request-1', {}, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.personalizationRequest.updateMany).not.toHaveBeenCalled();
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('restaura la solicitud a pendiente y conserva el pedido creado cuando falla la carga del comprobante', async () => {
    prisma.personalizationRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.personalizationRequest.findUnique.mockResolvedValue(baseRequest);
    ordersService.create.mockResolvedValue({
      id: 'order-1',
      paymentReceiptUrl: null,
    });
    prisma.personalizationRequest.update
      .mockResolvedValueOnce({
        ...baseRequest,
        configurationJson: {
          ...baseRequest.configurationJson,
          approvalOrderId: 'order-1',
        },
      })
      .mockResolvedValueOnce({
        ...baseRequest,
        status: PersonalizationRequestStatus.PENDING,
        configurationJson: {
          ...baseRequest.configurationJson,
          approvalOrderId: 'order-1',
        },
      });
    storageService.uploadFile.mockRejectedValue(new Error('storage down'));

    await expect(
      service.approveRequest('request-1', {}, 'admin-1', receiptFile),
    ).rejects.toThrow('storage down');

    expect(ordersService.create).toHaveBeenCalledTimes(1);
    expect(prisma.personalizationRequest.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          configurationJson: expect.objectContaining({
            approvalOrderId: 'order-1',
          }),
        }),
      }),
    );
    expect(prisma.personalizationRequest.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          status: PersonalizationRequestStatus.PENDING,
          configurationJson: expect.objectContaining({
            approvalOrderId: 'order-1',
          }),
        }),
      }),
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('reutiliza el pedido ya creado al reintentar una aprobacion incompleta', async () => {
    prisma.personalizationRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.personalizationRequest.findUnique.mockResolvedValue({
      ...baseRequest,
      configurationJson: {
        ...baseRequest.configurationJson,
        approvalOrderId: 'order-1',
      },
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentReceiptUrl: null,
    });
    storageService.uploadFile.mockResolvedValue(
      'https://cdn.example.com/receipts/order-1.pdf',
    );
    prisma.order.update.mockResolvedValue({
      id: 'order-1',
      paymentReceiptUrl: 'https://cdn.example.com/receipts/order-1.pdf',
    });
    prisma.personalizationRequest.update.mockResolvedValue({
      ...baseRequest,
      status: PersonalizationRequestStatus.APPROVED,
      configurationJson: {
        ...baseRequest.configurationJson,
        approvalOrderId: 'order-1',
      },
    });

    await service.approveRequest('request-1', {}, 'admin-1', receiptFile);

    expect(ordersService.create).not.toHaveBeenCalled();
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      select: { id: true, paymentReceiptUrl: true },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        paymentReceiptUrl: 'https://cdn.example.com/receipts/order-1.pdf',
      },
    });
    expect(prisma.personalizationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          status: PersonalizationRequestStatus.APPROVED,
          configurationJson: expect.objectContaining({
            approvalOrderId: 'order-1',
          }),
        }),
      }),
    );
  });
});
