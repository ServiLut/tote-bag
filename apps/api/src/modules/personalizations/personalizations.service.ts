import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { CreatePersonalizationDto } from './dto/create-personalization.dto';
import { Prisma } from '../../generated/client/client';
import { StorageService } from '../../common/storage/storage.service';
import { CreateSignedDesignUploadDto } from './dto/create-signed-design-upload.dto';
import { PricingService } from '../pricing/pricing.service';
import { OrdersService } from '../orders/orders.service';
import {
  PriceRuleScope,
  PersonalizationRequestStatus,
} from '../../generated/client/enums';
import { CreatePersonalizationRequestDto } from './dto/create-personalization-request.dto';
import { UpdatePersonalizationRequestDto } from './dto/update-personalization-request.dto';
import { ApprovePersonalizationRequestDto } from './dto/approve-personalization-request.dto';
import { normalizeSnapshotPersonalizations } from '../../common/interfaces/snapshots.interface';
import { CreateOrderDto } from '../orders/dto/create-order.dto';

type PersonalizationRequestForApproval = {
  id: string;
  status: PersonalizationRequestStatus;
  profileId: string | null;
  productId: string;
  variantId: string | null;
  quantity: number;
  line: string;
  size: string;
  material: string;
  quality: string | null;
  configCode: string;
  currency: string;
  designUrl: string | null;
  personalizations: Prisma.JsonValue;
  configurationJson: Prisma.JsonValue;
  product: {
    id: string;
    name: string;
    slug: string;
  };
  variant: {
    id: string;
    sku: string;
  } | null;
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string;
    department: string | null;
    municipality: string | null;
    neighborhood: string | null;
    address: string | null;
  } | null;
};

@Injectable()
export class PersonalizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly pricingService: PricingService,
    private readonly ordersService: OrdersService,
  ) {}

  private getRequestInclude() {
    return {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            take: 1,
            select: {
              url: true,
            },
            orderBy: {
              position: 'asc' as const,
            },
          },
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          color: true,
          imageUrl: true,
          stock: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      profile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          department: true,
          municipality: true,
          neighborhood: true,
          address: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    };
  }

  private rethrowIfRequestStorageUnavailable(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    ) {
      throw new ServiceUnavailableException(
        'El modulo de solicitudes de personalizacion requiere ejecutar la migracion pendiente en la base de datos.',
      );
    }

    throw error;
  }

  async createSignedUpload(data: CreateSignedDesignUploadDto) {
    this.validateFileMetadata(data.fileName, data.mimeType, data.size);

    // Opportunistic deferred cleanup to avoid accumulating abandoned uploads.
    void this.storageService
      .cleanupStaleCustomDesignUploads()
      .catch((error) => {
        console.error('Custom design cleanup error:', error);
      });

    const normalizedName = data.fileName
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `custom-designs/${Date.now()}-${normalizedName}`;
    const signedUpload = await this.storageService.createSignedUpload(
      'product-assets',
      path,
    );
    const publicUrl = this.storageService.getPublicUrl(
      'product-assets',
      signedUpload.path,
    );

    return {
      ...signedUpload,
      publicUrl,
    };
  }

  async uploadDesign(file: Express.Multer.File) {
    this.validateFileMetadata(file.originalname, file.mimetype, file.size);

    const normalizedName = file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `custom-designs/${Date.now()}-${normalizedName}`;
    const publicUrl = await this.storageService.uploadFile(
      'product-assets',
      path,
      file,
    );

    return { url: publicUrl, path };
  }

  async findRequests(status?: string) {
    const normalizedStatus = Object.values(
      PersonalizationRequestStatus,
    ).includes(status as PersonalizationRequestStatus)
      ? (status as PersonalizationRequestStatus)
      : undefined;

    try {
      return await this.prisma.personalizationRequest.findMany({
        where: normalizedStatus ? { status: normalizedStatus } : undefined,
        include: this.getRequestInclude(),
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.rethrowIfRequestStorageUnavailable(error);
    }
  }

  async createRequest(
    userId: string,
    data: CreatePersonalizationRequestDto,
    options?: { allowProfileOverride?: boolean },
  ) {
    const requestedProfileId =
      typeof data.profileId === 'string' && data.profileId.trim().length > 0
        ? data.profileId.trim()
        : null;

    if (requestedProfileId && !options?.allowProfileOverride) {
      throw new BadRequestException(
        'No puedes crear solicitudes para otro perfil.',
      );
    }

    const [profile, variant] = await Promise.all([
      requestedProfileId
        ? this.prisma.profile.findUnique({
            where: { id: requestedProfileId },
            select: { id: true, userId: true },
          })
        : this.prisma.profile.findUnique({
            where: { userId },
            select: { id: true, userId: true },
          }),
      data.variantId
        ? this.prisma.variant.findUnique({
            where: { id: data.variantId },
            select: { id: true, productId: true },
          })
        : Promise.resolve(null),
    ]);

    if (requestedProfileId && !profile) {
      throw new BadRequestException('El perfil seleccionado no existe.');
    }

    if (data.variantId && variant && variant.productId !== data.productId) {
      throw new BadRequestException(
        'La variante no corresponde al producto seleccionado.',
      );
    }

    if (data.variantId && !variant) {
      throw new BadRequestException('La variante seleccionada no existe.');
    }

    const quote = await this.pricingService.calculateQuote(
      {
        productId: data.productId,
        variantId: data.variantId,
        line: data.line,
        size: data.size,
        material: data.material,
        quality: data.quality,
        customImageURL: data.customImageURL,
        quantity: data.quantity,
        personalizations: data.personalizations,
      },
      PriceRuleScope.B2C,
    );

    const resolvedVariantId =
      typeof quote.snapshot.variantId === 'string' &&
      quote.snapshot.variantId.trim().length > 0
        ? quote.snapshot.variantId
        : (data.variantId ?? null);
    const resolvedSize =
      typeof quote.snapshot.size === 'string' &&
      quote.snapshot.size.trim().length > 0
        ? quote.snapshot.size
        : (data.size ?? '');

    const normalizedPersonalizations = normalizeSnapshotPersonalizations(
      data.personalizations ?? [],
    );

    try {
      return await this.prisma.personalizationRequest.create({
        data: {
          userId: profile?.userId ?? userId,
          profileId: profile?.id ?? null,
          productId: data.productId,
          variantId: resolvedVariantId,
          quantity: data.quantity,
          line: data.line,
          size: resolvedSize,
          material: data.material,
          quality: data.quality ?? null,
          configCode: quote.snapshot.configCode,
          unitPrice: quote.unitPrice,
          totalPrice: quote.total,
          currency: quote.currency,
          notes: data.notes?.trim() || null,
          designUrl: data.customImageURL?.trim() || null,
          status: PersonalizationRequestStatus.PENDING,
          personalizations: normalizedPersonalizations as Prisma.InputJsonValue,
          configurationJson: {
            productId: data.productId,
            variantId: resolvedVariantId,
            line: data.line,
            size: resolvedSize,
            material: data.material,
            quality: data.quality ?? null,
            quantity: data.quantity,
            customImageURL: data.customImageURL ?? null,
            personalizations: normalizedPersonalizations,
            configCode: quote.snapshot.configCode,
            createdAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          pricingJson: quote.snapshot as unknown as Prisma.InputJsonValue,
        },
        include: this.getRequestInclude(),
      });
    } catch (error) {
      this.rethrowIfRequestStorageUnavailable(error);
    }
  }

  async updateRequest(
    id: string,
    data: UpdatePersonalizationRequestDto,
    actorUserId: string,
  ) {
    try {
      return await this.prisma.personalizationRequest.update({
        where: { id },
        data: {
          status: data.status,
          reviewNotes: data.reviewNotes,
          notes: data.notes,
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
        include: this.getRequestInclude(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2021' || error.code === 'P2022')
      ) {
        throw new ServiceUnavailableException(
          'El modulo de solicitudes de personalizacion requiere ejecutar la migracion pendiente en la base de datos.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Personalization request with ID ${id} not found`,
        );
      }
      throw error;
    }
  }

  private validateReceiptFile(file: Express.Multer.File) {
    const allowedMimeTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/pdf',
    ]);
    const lowerName = file.originalname.toLowerCase();
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Solo se permiten comprobantes PNG, JPG, WEBP o PDF.',
      );
    }

    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      throw new BadRequestException(
        'El comprobante debe tener extension PNG, JPG, WEBP o PDF.',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'El comprobante supera el limite de 10 MB permitido.',
      );
    }
  }

  private buildOrderPayloadFromRequest(
    request: PersonalizationRequestForApproval | null,
  ): CreateOrderDto {
    if (!request) {
      throw new NotFoundException(
        'Solicitud de personalizacion no encontrada.',
      );
    }

    const requestProfile =
      request.profile &&
      typeof request.profile === 'object' &&
      !Array.isArray(request.profile)
        ? request.profile
        : null;

    if (!requestProfile) {
      throw new BadRequestException(
        'La solicitud no tiene un perfil asociado para crear el pedido.',
      );
    }

    const [derivedFirstName, ...derivedLastNameParts] = (
      `${requestProfile.firstName ?? ''} ${requestProfile.lastName ?? ''}`.trim() ||
      request.user.email.split('@')[0]
    )
      .split(/\s+/)
      .filter(Boolean);

    const firstName =
      requestProfile.firstName?.trim() || derivedFirstName || 'Cliente';
    const lastName =
      requestProfile.lastName?.trim() ||
      derivedLastNameParts.join(' ').trim() ||
      'Personalizacion';
    const customerEmail =
      requestProfile.email?.trim() || request.user.email?.trim();
    const customerPhone = requestProfile.phone?.trim() || 'Pendiente';
    const department = requestProfile.department?.trim() || 'Pendiente';
    const city = requestProfile.municipality?.trim() || 'Pendiente';
    const baseAddress = requestProfile.address?.trim();
    const neighborhood = requestProfile.neighborhood?.trim();
    const address =
      [baseAddress, neighborhood].filter(Boolean).join(', ') ||
      'Pendiente por confirmar';

    if (!customerEmail) {
      throw new BadRequestException(
        'La solicitud no tiene un correo valido para crear el pedido.',
      );
    }

    if (!request.variant?.id) {
      throw new BadRequestException(
        'La solicitud no tiene una variante comercial asociada. Debe recrearse con variantId explicito.',
      );
    }

    const configuration =
      request.configurationJson &&
      typeof request.configurationJson === 'object' &&
      !Array.isArray(request.configurationJson)
        ? (request.configurationJson as Record<string, unknown>)
        : null;

    const personalizations = Array.isArray(request.personalizations)
      ? request.personalizations
      : [];

    return {
      firstName,
      lastName,
      customerEmail,
      customerPhone,
      department,
      city,
      shippingAddress: {
        city,
        address,
        phone: customerPhone,
      },
      currency: request.currency,
      profileId: requestProfile.id,
      isB2B: false,
      isManual: true,
      source: 'MANUAL',
      initialStatus: 'PENDIENTE_PAGO',
      items: [
        {
          productId: request.product.id,
          variantId: request.variant.id,
          sku: request.variant?.sku || request.configCode,
          quantity: request.quantity,
          configuration: {
            productId: request.product.id,
            variantId: request.variant.id,
            line: request.line,
            size: request.size,
            material: request.material,
            quality: request.quality ?? undefined,
            customImageURL:
              typeof configuration?.customImageURL === 'string'
                ? configuration.customImageURL
                : (request.designUrl ?? undefined),
            quantity: request.quantity,
            personalizations: personalizations as {
              code: string;
              options?: string[];
            }[],
          },
        },
      ],
    };
  }

  async approveRequest(
    id: string,
    data: ApprovePersonalizationRequestDto,
    actorUserId: string,
    receiptFile?: Express.Multer.File,
  ) {
    try {
      if (!receiptFile) {
        throw new BadRequestException(
          'Debes adjuntar un comprobante antes de aprobar la solicitud.',
        );
      }

      this.validateReceiptFile(receiptFile);

      const request = (await this.prisma.personalizationRequest.findUnique({
        where: { id },
        include: this.getRequestInclude(),
      })) as PersonalizationRequestForApproval | null;

      if (!request) {
        throw new NotFoundException(
          `Personalization request with ID ${id} not found`,
        );
      }

      if (request.status === PersonalizationRequestStatus.APPROVED) {
        throw new ConflictException(
          'La solicitud ya fue aprobada y convertida en pedido.',
        );
      }

      const createdOrder = await this.ordersService.create(
        this.buildOrderPayloadFromRequest(request),
        actorUserId,
      );

      const normalizedName = receiptFile.originalname
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const receiptPath = `receipts/order/${createdOrder.id}-${Date.now()}-${normalizedName}`;
      const receiptUrl = await this.storageService.uploadFile(
        'payment-receipts',
        receiptPath,
        receiptFile,
      );

      await this.prisma.order.update({
        where: { id: createdOrder.id },
        data: { paymentReceiptUrl: receiptUrl },
      });

      return await this.prisma.personalizationRequest.update({
        where: { id },
        data: {
          status: PersonalizationRequestStatus.APPROVED,
          reviewNotes: data.reviewNotes,
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
        include: this.getRequestInclude(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2021' || error.code === 'P2022')
      ) {
        throw new ServiceUnavailableException(
          'El modulo de solicitudes de personalizacion requiere ejecutar la migracion pendiente en la base de datos.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Personalization request with ID ${id} not found`,
        );
      }
      throw error;
    }
  }

  private validateFileMetadata(
    fileName: string,
    mimeType: string,
    size?: number,
  ) {
    const allowedMimeTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ]);
    const lowerName = fileName.toLowerCase();
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

    if (!allowedMimeTypes.has(mimeType)) {
      throw new BadRequestException(
        'Solo se permiten imagenes PNG, JPG o WEBP.',
      );
    }

    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      throw new BadRequestException(
        'El archivo debe tener extension PNG, JPG o WEBP.',
      );
    }

    if (size && size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'El archivo supera el limite de 5 MB permitido.',
      );
    }
  }

  async findAll() {
    try {
      const options = await this.prisma.personalizationOption.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return options;
    } catch (error) {
      console.error('[PersonalizationsService] Error in findAll:', error);
      throw error;
    }
  }

  async create(data: CreatePersonalizationDto) {
    try {
      // Generate code from name if not provided
      const code =
        data.code ||
        data.name
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w-]/g, '');

      return await this.prisma.personalizationOption.create({
        data: {
          name: data.name,
          code,
          basePrice: data.basePrice,
          allowedMaterialValues: data.allowedMaterialValues || [],
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A personalization with this code already exists',
        );
      }
      throw error;
    }
  }

  async update(id: string, data: UpdatePersonalizationDto) {
    try {
      const option = await this.prisma.personalizationOption.update({
        where: { id },
        data: {
          basePrice: data.basePrice,
          allowedMaterialValues: data.allowedMaterialValues,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
      return option;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Personalization option with ID ${id} not found`,
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.personalizationOption.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Personalization option with ID ${id} not found`,
        );
      }
      throw error;
    }
  }
}
