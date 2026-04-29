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
import {
  decimalToNumber,
  roundMoney,
  toDecimal,
} from '../../common/utils/sales-tax.util';

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
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
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

type PersonalizationRequestConfigurationRecord = Record<string, unknown> & {
  approvalOrderId?: string;
  approvalStartedAt?: string;
  approvalReceiptUploadedAt?: string;
  approvedAt?: string;
  approvedUnitPrice?: number;
  approvedTotalPrice?: number;
  priceApprovedAt?: string;
  priceApprovedByUserId?: string;
};

type PersonalizationRequestApprovalSnapshot = {
  status: PersonalizationRequestStatus;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
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

  private getConfigurationRecord(
    value: Prisma.JsonValue | null | undefined,
  ): PersonalizationRequestConfigurationRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }

  private ensureRequestPatchDoesNotBypassApproval(
    status?: PersonalizationRequestStatus,
  ) {
    if (
      status === PersonalizationRequestStatus.APPROVED ||
      status === PersonalizationRequestStatus.IN_REVIEW
    ) {
      throw new BadRequestException(
        'La aprobacion solo se puede registrar desde el endpoint de aprobacion con comprobante.',
      );
    }
  }

  private async lockRequestForApproval(
    id: string,
  ): Promise<PersonalizationRequestApprovalSnapshot> {
    const currentRequest = await this.prisma.personalizationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        reviewedByUserId: true,
        unitPrice: true,
        totalPrice: true,
      },
    });

    if (!currentRequest) {
      throw new NotFoundException(
        `Personalization request with ID ${id} not found`,
      );
    }

    if (currentRequest.status === PersonalizationRequestStatus.APPROVED) {
      throw new ConflictException(
        'La solicitud ya fue aprobada y convertida en pedido.',
      );
    }

    if (currentRequest.status === PersonalizationRequestStatus.IN_REVIEW) {
      throw new ConflictException(
        'La solicitud ya se encuentra en proceso de aprobacion. Intenta de nuevo en unos segundos.',
      );
    }

    const result = await this.prisma.personalizationRequest.updateMany({
      where: {
        id,
        status: currentRequest.status,
      },
      data: {
        status: PersonalizationRequestStatus.IN_REVIEW,
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'La solicitud cambio de estado mientras se intentaba aprobar. Intenta de nuevo en unos segundos.',
      );
    }

    return {
      status: currentRequest.status,
      reviewedAt: currentRequest.reviewedAt,
      reviewedByUserId: currentRequest.reviewedByUserId,
      unitPrice: currentRequest.unitPrice,
      totalPrice: currentRequest.totalPrice,
    };
  }

  private async restoreApprovalState(
    id: string,
    snapshot: PersonalizationRequestApprovalSnapshot,
    configuration: PersonalizationRequestConfigurationRecord,
  ) {
    try {
      await this.prisma.personalizationRequest.update({
        where: { id },
        data: {
          status: snapshot.status,
          reviewedAt: snapshot.reviewedAt,
          reviewedByUserId: snapshot.reviewedByUserId,
          unitPrice: snapshot.unitPrice,
          totalPrice: snapshot.totalPrice,
          configurationJson: configuration as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (restoreError) {
      console.error(
        `Failed to restore personalization request ${id} after approval error:`,
        restoreError,
      );
    }
  }

  private async ensureDefaultProfileForUser(
    userId: string,
    userEmail?: string | null,
  ) {
    const existingProfile = await this.prisma.profile.findUnique({
      where: { userId },
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

    if (existingProfile) {
      return existingProfile;
    }

    const normalizedEmail =
      userEmail?.trim() ||
      (
        await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        })
      )?.email?.trim();

    if (!normalizedEmail) {
      throw new BadRequestException(
        'No fue posible resolver un perfil valido para la solicitud.',
      );
    }

    return this.prisma.profile.create({
      data: {
        email: normalizedEmail,
        userId,
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
  }

  async createSignedUpload(data: CreateSignedDesignUploadDto) {
    this.validateFileMetadata(data.fileName, data.mimeType, data.size);

    // Opportunistic deferred cleanup to avoid accumulating abandoned uploads.
    void this.storageService
      .cleanupStaleCustomDesignUploads()
      .catch((error) => {
        console.error('Custom design cleanup error:', error);
      });

    const normalizedName = this.ensureSupportedImageFileName(
      data.fileName,
      data.mimeType,
    )
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

    const normalizedName = this.ensureSupportedImageFileName(
      file.originalname,
      file.mimetype,
    )
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

  async findRequestById(id: string) {
    try {
      const request = await this.prisma.personalizationRequest.findUnique({
        where: { id },
        include: this.getRequestInclude(),
      });

      if (!request) {
        throw new NotFoundException(
          `Personalization request with ID ${id} not found`,
        );
      }

      return request;
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
        : this.ensureDefaultProfileForUser(userId),
      data.variantId
        ? this.prisma.variant.findUnique({
            where: { id: data.variantId },
            select: { id: true, productId: true },
          })
        : Promise.resolve(null),
    ]);

    if (!profile) {
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
          userId: profile.userId,
          profileId: profile.id,
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
      const currentRequest =
        await this.prisma.personalizationRequest.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            profileId: true,
            productId: true,
            variantId: true,
            quantity: true,
            line: true,
            size: true,
            material: true,
            quality: true,
            status: true,
            notes: true,
            reviewNotes: true,
            designUrl: true,
            personalizations: true,
            configurationJson: true,
          },
        });

      if (!currentRequest) {
        throw new NotFoundException(
          `Personalization request with ID ${id} not found`,
        );
      }

      if (currentRequest.status === PersonalizationRequestStatus.APPROVED) {
        throw new ConflictException(
          'Las solicitudes aprobadas no se pueden editar.',
        );
      }

      if (currentRequest.status === PersonalizationRequestStatus.IN_REVIEW) {
        throw new ConflictException(
          'La solicitud ya se encuentra en proceso de aprobacion.',
        );
      }

      this.ensureRequestPatchDoesNotBypassApproval(data.status);

      const nextProfileId = data.profileId ?? currentRequest.profileId;
      const nextProductId = data.productId ?? currentRequest.productId;
      const nextVariantId = data.variantId ?? currentRequest.variantId;
      const nextLine = data.line ?? currentRequest.line;
      const nextSize = data.size ?? currentRequest.size;
      const nextMaterial = data.material ?? currentRequest.material;
      const nextQuality =
        data.quality !== undefined ? data.quality : currentRequest.quality;
      const nextQuantity = data.quantity ?? currentRequest.quantity;
      const nextDesignUrl =
        data.customImageURL !== undefined
          ? data.customImageURL?.trim() || null
          : currentRequest.designUrl;

      const nextNotes =
        data.notes !== undefined
          ? data.notes?.trim() || null
          : currentRequest.notes;
      const nextReviewNotes =
        data.reviewNotes !== undefined
          ? data.reviewNotes?.trim() || null
          : currentRequest.reviewNotes;
      const nextStatus = data.status ?? currentRequest.status;
      const nextPersonalizations =
        data.personalizations ??
        (Array.isArray(currentRequest.personalizations)
          ? currentRequest.personalizations
          : []);

      if (!nextVariantId) {
        throw new BadRequestException(
          'La solicitud debe conservar una variante comercial asociada.',
        );
      }

      const sanitizedPersonalizations = Array.isArray(nextPersonalizations)
        ? nextPersonalizations
            .filter(
              (
                personalization,
              ): personalization is {
                code: string;
                options?: string[];
              } =>
                !!personalization &&
                typeof personalization === 'object' &&
                'code' in personalization &&
                typeof personalization.code === 'string',
            )
            .map((personalization) => ({
              code: personalization.code,
              options: Array.isArray(personalization.options)
                ? personalization.options.filter(
                    (option): option is string => typeof option === 'string',
                  )
                : undefined,
            }))
        : [];

      const [profile, variant] = await Promise.all([
        nextProfileId
          ? this.prisma.profile.findUnique({
              where: { id: nextProfileId },
              select: { id: true, userId: true },
            })
          : this.ensureDefaultProfileForUser(currentRequest.userId),
        nextVariantId
          ? this.prisma.variant.findUnique({
              where: { id: nextVariantId },
              select: { id: true, productId: true },
            })
          : Promise.resolve(null),
      ]);

      if (!profile) {
        throw new BadRequestException('El perfil seleccionado no existe.');
      }

      if (nextVariantId && !variant) {
        throw new BadRequestException('La variante seleccionada no existe.');
      }

      if (nextVariantId && variant && variant.productId !== nextProductId) {
        throw new BadRequestException(
          'La variante no corresponde al producto seleccionado.',
        );
      }

      const quote = await this.pricingService.calculateQuote(
        {
          productId: nextProductId,
          variantId: nextVariantId,
          line: nextLine,
          size: nextSize,
          material: nextMaterial,
          quality: nextQuality ?? undefined,
          customImageURL: nextDesignUrl ?? undefined,
          quantity: nextQuantity,
          personalizations: sanitizedPersonalizations,
        },
        PriceRuleScope.B2C,
      );

      const resolvedVariantId =
        typeof quote.snapshot.variantId === 'string' &&
        quote.snapshot.variantId.trim().length > 0
          ? quote.snapshot.variantId
          : nextVariantId;
      const resolvedSize =
        typeof quote.snapshot.size === 'string' &&
        quote.snapshot.size.trim().length > 0
          ? quote.snapshot.size
          : nextSize;

      const normalizedPersonalizations = normalizeSnapshotPersonalizations(
        sanitizedPersonalizations,
      );

      const configurationRecord =
        currentRequest.configurationJson &&
        typeof currentRequest.configurationJson === 'object' &&
        !Array.isArray(currentRequest.configurationJson)
          ? (currentRequest.configurationJson as Record<string, unknown>)
          : {};

      return await this.prisma.personalizationRequest.update({
        where: { id },
        data: {
          userId: profile.userId,
          profileId: profile.id,
          productId: nextProductId,
          variantId: resolvedVariantId,
          quantity: nextQuantity,
          line: nextLine,
          size: resolvedSize,
          material: nextMaterial,
          quality: nextQuality ?? null,
          configCode: quote.snapshot.configCode,
          unitPrice: quote.unitPrice,
          totalPrice: quote.total,
          currency: quote.currency,
          status: nextStatus,
          notes: nextNotes,
          reviewNotes: nextReviewNotes,
          designUrl: nextDesignUrl,
          personalizations: normalizedPersonalizations as Prisma.InputJsonValue,
          configurationJson: {
            ...configurationRecord,
            productId: nextProductId,
            variantId: resolvedVariantId,
            line: nextLine,
            size: resolvedSize,
            material: nextMaterial,
            quality: nextQuality ?? null,
            quantity: nextQuantity,
            customImageURL: nextDesignUrl,
            personalizations: normalizedPersonalizations,
            configCode: quote.snapshot.configCode,
            updatedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          pricingJson: quote.snapshot as unknown as Prisma.InputJsonValue,
          reviewedAt:
            data.status !== undefined || data.reviewNotes !== undefined
              ? new Date()
              : undefined,
          reviewedByUserId:
            data.status !== undefined || data.reviewNotes !== undefined
              ? actorUserId
              : undefined,
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

  async removeRequest(id: string) {
    try {
      const request = await this.prisma.personalizationRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!request) {
        throw new NotFoundException(
          `Personalization request with ID ${id} not found`,
        );
      }

      if (request.status === PersonalizationRequestStatus.APPROVED) {
        throw new ConflictException(
          'Las solicitudes aprobadas no se pueden eliminar.',
        );
      }

      return await this.prisma.personalizationRequest.delete({
        where: { id },
      });
    } catch (error) {
      this.rethrowIfRequestStorageUnavailable(error);
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

    if (file.size < 1) {
      throw new BadRequestException('El comprobante seleccionado esta vacio.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'El comprobante supera el limite de 10 MB permitido.',
      );
    }
  }

  private buildOrderPayloadFromRequest(
    request: PersonalizationRequestForApproval | null,
    approvedUnitPrice?: number,
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
          ...(typeof approvedUnitPrice === 'number'
            ? {
                price: approvedUnitPrice,
              }
            : {}),
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
    let shouldRestorePendingState = false;
    let configurationRecord: PersonalizationRequestConfigurationRecord = {};
    let approvalSnapshot: PersonalizationRequestApprovalSnapshot | null = null;

    try {
      if (!receiptFile) {
        throw new BadRequestException(
          'Debes adjuntar un comprobante antes de aprobar la solicitud.',
        );
      }

      this.validateReceiptFile(receiptFile);

      approvalSnapshot = await this.lockRequestForApproval(id);
      shouldRestorePendingState = true;

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

      configurationRecord = this.getConfigurationRecord(
        request.configurationJson,
      );

      const requestedApprovedUnitPrice =
        typeof data.approvedUnitPrice === 'number' &&
        Number.isFinite(data.approvedUnitPrice) &&
        data.approvedUnitPrice > 0
          ? decimalToNumber(data.approvedUnitPrice)
          : decimalToNumber(request.unitPrice);
      const hasApprovedUnitPriceOverride =
        typeof data.approvedUnitPrice === 'number' &&
        Number.isFinite(data.approvedUnitPrice) &&
        data.approvedUnitPrice > 0;
      let approvedUnitPrice = decimalToNumber(
        roundMoney(requestedApprovedUnitPrice),
      );
      let approvedTotalPrice = decimalToNumber(
        roundMoney(toDecimal(approvedUnitPrice).mul(request.quantity)),
      );

      if (!request.profile) {
        const resolvedProfile = await this.ensureDefaultProfileForUser(
          request.user.id,
          request.user.email,
        );

        request.profileId = resolvedProfile.id;
        request.profile = {
          id: resolvedProfile.id,
          firstName: resolvedProfile.firstName,
          lastName: resolvedProfile.lastName,
          phone: resolvedProfile.phone,
          email: resolvedProfile.email,
          department: resolvedProfile.department,
          municipality: resolvedProfile.municipality,
          neighborhood: resolvedProfile.neighborhood,
          address: resolvedProfile.address,
        };

        await this.prisma.personalizationRequest.update({
          where: { id },
          data: {
            profileId: resolvedProfile.id,
          },
        });
      }

      const existingOrderId =
        typeof configurationRecord.approvalOrderId === 'string' &&
        configurationRecord.approvalOrderId.trim().length > 0
          ? configurationRecord.approvalOrderId.trim()
          : null;

      let orderId = existingOrderId;
      let existingOrder = orderId
        ? await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, paymentReceiptUrl: true },
          })
        : null;

      if (
        existingOrder &&
        hasApprovedUnitPriceOverride &&
        approvedUnitPrice !== decimalToNumber(roundMoney(request.unitPrice))
      ) {
        await this.ordersService.remove(existingOrder.id);
        orderId = null;
        existingOrder = null;

        /* eslint-disable @typescript-eslint/no-unused-vars */
        const {
          approvalOrderId: _approvalOrderId,
          approvalStartedAt: _approvalStartedAt,
          approvalReceiptUploadedAt: _approvalReceiptUploadedAt,
          approvedAt: _approvedAt,
          approvedUnitPrice: _approvedUnitPrice,
          approvedTotalPrice: _approvedTotalPrice,
          priceApprovedAt: _priceApprovedAt,
          priceApprovedByUserId: _priceApprovedByUserId,
          ...nextConfigurationRecord
        } = configurationRecord;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        configurationRecord = nextConfigurationRecord;
      }

      if (!existingOrder) {
        const createdOrder = await this.ordersService.create(
          this.buildOrderPayloadFromRequest(request, approvedUnitPrice),
          actorUserId,
        );

        orderId = createdOrder.id;
        existingOrder = {
          id: createdOrder.id,
          paymentReceiptUrl: createdOrder.paymentReceiptUrl ?? null,
        };
        configurationRecord = {
          ...configurationRecord,
          approvalOrderId: orderId,
          approvalStartedAt: new Date().toISOString(),
          approvedUnitPrice,
          approvedTotalPrice,
          priceApprovedAt: new Date().toISOString(),
          priceApprovedByUserId: actorUserId,
        };

        await this.prisma.personalizationRequest.update({
          where: { id },
          data: {
            unitPrice: approvedUnitPrice,
            totalPrice: approvedTotalPrice,
            configurationJson:
              configurationRecord as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        approvedUnitPrice = decimalToNumber(request.unitPrice);
        approvedTotalPrice = decimalToNumber(request.totalPrice);
        configurationRecord = {
          ...configurationRecord,
          approvedUnitPrice,
          approvedTotalPrice,
          priceApprovedAt:
            configurationRecord.priceApprovedAt ?? new Date().toISOString(),
          priceApprovedByUserId:
            configurationRecord.priceApprovedByUserId ?? actorUserId,
        };
      }

      if (!orderId) {
        throw new BadRequestException(
          'No fue posible resolver el pedido asociado a la aprobacion.',
        );
      }

      const normalizedName = receiptFile.originalname
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const receiptPath = `receipts/order/${orderId}-${Date.now()}-${normalizedName}`;
      const receiptUrl = await this.storageService.uploadFile(
        'payment-receipts',
        receiptPath,
        receiptFile,
      );

      await this.ordersService.confirmPendingOrderPayment(
        orderId,
        actorUserId,
        undefined,
        receiptUrl,
      );

      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentReceiptUrl: receiptUrl },
      });

      configurationRecord = {
        ...configurationRecord,
        approvalOrderId: orderId,
        approvalReceiptUploadedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
      };

      const approvedRequest = await this.prisma.personalizationRequest.update({
        where: { id },
        data: {
          status: PersonalizationRequestStatus.APPROVED,
          unitPrice: approvedUnitPrice,
          totalPrice: approvedTotalPrice,
          reviewNotes: data.reviewNotes?.trim() || null,
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
          configurationJson:
            configurationRecord as unknown as Prisma.InputJsonValue,
        },
        include: this.getRequestInclude(),
      });

      shouldRestorePendingState = false;
      return approvedRequest;
    } catch (error) {
      if (shouldRestorePendingState && approvalSnapshot) {
        await this.restoreApprovalState(
          id,
          approvalSnapshot,
          configurationRecord,
        );
      }

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
    size: number,
  ) {
    const allowedMimeTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ]);
    const lowerName = fileName.trim().toLowerCase();
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const hasAnyExtension = /\.[a-z0-9]+$/i.test(lowerName);

    if (!allowedMimeTypes.has(mimeType)) {
      throw new BadRequestException(
        'Solo se permiten imagenes PNG, JPG o WEBP.',
      );
    }

    if (
      hasAnyExtension &&
      !allowedExtensions.some((extension) => lowerName.endsWith(extension))
    ) {
      throw new BadRequestException(
        'El archivo debe tener extension PNG, JPG o WEBP.',
      );
    }

    if (size < 1) {
      throw new BadRequestException('El archivo seleccionado esta vacio.');
    }

    if (size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'El archivo supera el limite de 5 MB permitido.',
      );
    }
  }

  private ensureSupportedImageFileName(fileName: string, mimeType: string) {
    const trimmedName = fileName.trim() || 'diseno-personalizado';
    const hasAllowedExtension = /\.(png|jpe?g|webp)$/i.test(trimmedName);

    if (hasAllowedExtension) {
      return trimmedName;
    }

    return `${trimmedName}${this.getAllowedImageExtensionForMimeType(mimeType)}`;
  }

  private getAllowedImageExtensionForMimeType(mimeType: string) {
    switch (mimeType) {
      case 'image/png':
        return '.png';
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      default:
        throw new BadRequestException(
          'Solo se permiten imagenes PNG, JPG o WEBP.',
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
