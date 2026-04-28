import { BadRequestException } from '@nestjs/common';
import { PersonalizationRequestStatus } from '../../generated/client/enums';
import { PersonalizationsService } from './personalizations.service';

describe('PersonalizationsService', () => {
  const prisma = {
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    variant: {
      findUnique: jest.fn(),
    },
    personalizationRequest: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  const pricingService = {
    calculateQuote: jest.fn(),
  };

  const ordersService = {
    create: jest.fn(),
    confirmPendingOrderPayment: jest.fn(),
  };

  const service = new PersonalizationsService(
    prisma as never,
    storageService as never,
    pricingService as never,
    ordersService as never,
  );

  const receiptFile = {
    originalname: 'comprobante.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('receipt'),
  } as Express.Multer.File;

  const createdProfile = {
    id: 'profile-1',
    userId: 'user-1',
    firstName: null,
    lastName: null,
    phone: null,
    email: 'cliente@example.com',
    department: null,
    municipality: null,
    neighborhood: null,
    address: null,
  };

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

  const editableRequest = {
    id: 'request-1',
    userId: 'user-1',
    profileId: 'profile-1',
    productId: 'product-1',
    variantId: 'variant-1',
    quantity: 2,
    line: 'CORPORATIVA',
    size: 'Mediana',
    material: 'Lona',
    quality: null,
    status: PersonalizationRequestStatus.PENDING,
    notes: null,
    reviewNotes: null,
    designUrl: 'https://cdn.example.com/custom-designs/logo.png',
    personalizations: [],
    configurationJson: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea un perfil por defecto para solicitudes publicas si el usuario no tiene uno', async () => {
    prisma.profile.findUnique.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      email: 'cliente@example.com',
    });
    prisma.profile.create.mockResolvedValueOnce(createdProfile);
    prisma.variant.findUnique.mockResolvedValueOnce({
      id: 'variant-1',
      productId: 'product-1',
    });
    pricingService.calculateQuote.mockResolvedValueOnce({
      unitPrice: 10000,
      total: 20000,
      currency: 'COP',
      snapshot: {
        variantId: 'variant-1',
        size: 'Mediana',
        configCode: 'CFG-001',
      },
    });
    prisma.personalizationRequest.create.mockResolvedValueOnce({
      id: 'request-1',
    });

    await service.createRequest('user-1', {
      productId: 'product-1',
      variantId: 'variant-1',
      line: 'CORPORATIVA',
      size: 'Mediana',
      material: 'Lona',
      quantity: 2,
      personalizations: [],
    } as never);

    expect(prisma.profile.create).toHaveBeenCalledWith({
      data: {
        email: 'cliente@example.com',
        userId: 'user-1',
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        department: true,
        municipality: true,
        neighborhood: true,
        address: true,
      },
    });
    expect(prisma.personalizationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          profileId: 'profile-1',
        }) as never,
      }),
    );
  });

  it('bloquea aprobar una solicitud desde updateRequest', async () => {
    prisma.personalizationRequest.findUnique.mockResolvedValueOnce(
      editableRequest,
    );

    await expect(
      service.updateRequest(
        'request-1',
        { status: PersonalizationRequestStatus.APPROVED } as never,
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(pricingService.calculateQuote).not.toHaveBeenCalled();
    expect(prisma.personalizationRequest.update).not.toHaveBeenCalled();
  });

  it('exige comprobante para aprobar una solicitud', async () => {
    await expect(
      service.approveRequest('request-1', {}, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.personalizationRequest.updateMany).not.toHaveBeenCalled();
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('restaura la solicitud al estado previo cuando falla la carga del comprobante', async () => {
    const reviewedAt = new Date('2026-04-26T10:00:00.000Z');

    prisma.personalizationRequest.findUnique
      .mockResolvedValueOnce({
        id: 'request-1',
        status: PersonalizationRequestStatus.REJECTED,
        reviewedAt,
        reviewedByUserId: 'reviewer-1',
      })
      .mockResolvedValueOnce({
        ...baseRequest,
        status: PersonalizationRequestStatus.IN_REVIEW,
      });
    prisma.personalizationRequest.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    ordersService.create.mockResolvedValueOnce({
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
        status: PersonalizationRequestStatus.REJECTED,
        reviewedAt,
        reviewedByUserId: 'reviewer-1',
        configurationJson: {
          ...baseRequest.configurationJson,
          approvalOrderId: 'order-1',
        },
      });
    storageService.uploadFile.mockRejectedValueOnce(new Error('storage down'));

    await expect(
      service.approveRequest('request-1', {}, 'admin-1', receiptFile),
    ).rejects.toThrow('storage down');

    expect(ordersService.create).toHaveBeenCalledTimes(1);
    expect(prisma.personalizationRequest.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          status: PersonalizationRequestStatus.REJECTED,
          reviewedAt,
          reviewedByUserId: 'reviewer-1',
          configurationJson: expect.objectContaining({
            approvalOrderId: 'order-1',
          }) as never,
        }) as never,
      }),
    );
    expect(ordersService.confirmPendingOrderPayment).not.toHaveBeenCalled();
  });

  it('confirma el pago pendiente y actualiza el comprobante al aprobar una solicitud', async () => {
    prisma.personalizationRequest.findUnique
      .mockResolvedValueOnce({
        id: 'request-1',
        status: PersonalizationRequestStatus.PENDING,
        reviewedAt: null,
        reviewedByUserId: null,
      })
      .mockResolvedValueOnce({
        ...baseRequest,
        configurationJson: {
          ...baseRequest.configurationJson,
          approvalOrderId: 'order-1',
        },
      });
    prisma.personalizationRequest.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    prisma.order.findUnique.mockResolvedValueOnce({
      id: 'order-1',
      paymentReceiptUrl: null,
    });
    storageService.uploadFile.mockResolvedValueOnce(
      'https://cdn.example.com/receipts/order-1.pdf',
    );
    ordersService.confirmPendingOrderPayment.mockResolvedValueOnce({
      id: 'order-1',
    });
    prisma.order.update.mockResolvedValueOnce({
      id: 'order-1',
      paymentReceiptUrl: 'https://cdn.example.com/receipts/order-1.pdf',
    });
    prisma.personalizationRequest.update.mockResolvedValueOnce({
      ...baseRequest,
      status: PersonalizationRequestStatus.APPROVED,
      configurationJson: {
        ...baseRequest.configurationJson,
        approvalOrderId: 'order-1',
      },
    });

    await service.approveRequest('request-1', {}, 'admin-1', receiptFile);

    expect(ordersService.create).not.toHaveBeenCalled();
    expect(ordersService.confirmPendingOrderPayment).toHaveBeenCalledWith(
      'order-1',
      'admin-1',
      undefined,
      'https://cdn.example.com/receipts/order-1.pdf',
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        paymentReceiptUrl: 'https://cdn.example.com/receipts/order-1.pdf',
      },
    });
  });

  it('crea y asocia un perfil por defecto al aprobar una solicitud legacy sin perfil', async () => {
    prisma.personalizationRequest.findUnique
      .mockResolvedValueOnce({
        id: 'request-1',
        status: PersonalizationRequestStatus.PENDING,
        reviewedAt: null,
        reviewedByUserId: null,
      })
      .mockResolvedValueOnce({
        ...baseRequest,
        profileId: null,
        profile: null,
      });
    prisma.personalizationRequest.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    prisma.profile.findUnique.mockResolvedValueOnce(null);
    prisma.profile.create.mockResolvedValueOnce(createdProfile);
    ordersService.create.mockResolvedValueOnce({
      id: 'order-1',
      paymentReceiptUrl: null,
    });
    storageService.uploadFile.mockResolvedValueOnce(
      'https://cdn.example.com/receipts/order-1.pdf',
    );
    ordersService.confirmPendingOrderPayment.mockResolvedValueOnce({
      id: 'order-1',
    });
    prisma.order.update.mockResolvedValueOnce({
      id: 'order-1',
      paymentReceiptUrl: 'https://cdn.example.com/receipts/order-1.pdf',
    });
    prisma.personalizationRequest.update
      .mockResolvedValueOnce({
        ...baseRequest,
        profileId: 'profile-1',
      })
      .mockResolvedValueOnce({
        ...baseRequest,
        configurationJson: {
          ...baseRequest.configurationJson,
          approvalOrderId: 'order-1',
        },
      })
      .mockResolvedValueOnce({
        ...baseRequest,
        status: PersonalizationRequestStatus.APPROVED,
        configurationJson: {
          ...baseRequest.configurationJson,
          approvalOrderId: 'order-1',
        },
      });

    await service.approveRequest('request-1', {}, 'admin-1', receiptFile);

    expect(prisma.profile.create).toHaveBeenCalledWith({
      data: {
        email: 'cliente@example.com',
        userId: 'user-1',
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        department: true,
        municipality: true,
        neighborhood: true,
        address: true,
      },
    });
    expect(prisma.personalizationRequest.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'request-1' },
        data: {
          profileId: 'profile-1',
        },
      }),
    );
  });
});
