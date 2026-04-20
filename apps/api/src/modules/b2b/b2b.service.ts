import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateQuoteDto,
  B2BPackage,
  B2B_MINIMUM_QUANTITY,
  B2BQuoteItemTypeInput,
  CreateQuoteItemDto,
} from './dto/create-quote.dto';
import { PricingService } from '../pricing/pricing.service';
import {
  B2BQuoteItemType,
  B2BReservationStatus,
  PriceRuleScope,
} from '../../generated/client/enums';
import { Prisma } from '../../generated/client/client';
import {
  ConfigurationSnapshot,
  normalizeSnapshotPersonalizations,
} from '../../common/interfaces/snapshots.interface';
import { StorageService } from '../../common/storage/storage.service';
import { InventoryService } from '../inventory/inventory.service';

type PreparedQuoteItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  configurationJson: Prisma.InputJsonValue;
  pricingJson: Prisma.InputJsonValue;
  itemType: B2BQuoteItemType;
  manualSize: string | null;
  manualSpecs: Prisma.InputJsonValue;
  externalUnitCost: number | null;
  agreedUnitPrice: number | null;
  shouldReserve: boolean;
};

type CreateQuoteOptions = {
  allowManualItems?: boolean;
};

@Injectable()
export class B2bService {
  private static readonly APPROVED_DESIGN_STATUSES = new Set([
    'DISEÑO_APROBADO',
    'DISEÃ‘O_APROBADO',
    'DISEÃƒâ€˜O_APROBADO',
    'DISEÃƒÆ’Ã¢â‚¬ËœO_APROBADO',
    'DISEÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“O_APROBADO',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    private readonly storageService: StorageService,
    private readonly inventoryService: InventoryService,
  ) {}

  calculatePackage(quantity: number): B2BPackage {
    if (quantity < 100) return B2BPackage.EMPRESA;
    return B2BPackage.EVENTO;
  }

  private getReservationHours(createQuoteDto: CreateQuoteDto) {
    const configuredHours = Number(
      createQuoteDto.reservationHours ??
        this.configService.get<string | number>(
          'B2B_QUOTE_RESERVATION_HOURS',
        ) ??
        48,
    );

    return Number.isFinite(configuredHours) ? Math.max(1, configuredHours) : 48;
  }

  private resolveItemType(item: CreateQuoteItemDto) {
    if (item.itemType === B2BQuoteItemTypeInput.MANUAL_EXTERNAL_PRODUCTION) {
      return B2BQuoteItemType.MANUAL_EXTERNAL_PRODUCTION;
    }

    if (item.itemType === B2BQuoteItemTypeInput.STANDARD_STOCK) {
      return B2BQuoteItemType.STANDARD_STOCK;
    }

    if (
      item.manualSize ||
      item.manualSpecs ||
      item.externalUnitCost !== undefined ||
      item.agreedUnitPrice !== undefined
    ) {
      return B2BQuoteItemType.MANUAL_EXTERNAL_PRODUCTION;
    }

    return B2BQuoteItemType.STANDARD_STOCK;
  }

  private hasManualQuoteFields(item: CreateQuoteItemDto) {
    return (
      item.itemType === B2BQuoteItemTypeInput.MANUAL_EXTERNAL_PRODUCTION ||
      item.manualSize !== undefined ||
      item.manualSpecs !== undefined ||
      item.externalUnitCost !== undefined ||
      item.agreedUnitPrice !== undefined
    );
  }

  private async prepareQuoteItem(
    item: CreateQuoteItemDto,
    options?: CreateQuoteOptions,
  ): Promise<PreparedQuoteItem> {
    if (!options?.allowManualItems && this.hasManualQuoteFields(item)) {
      throw new BadRequestException(
        'Las cotizaciones manuales con costo externo o precio acordado deben ser creadas por un administrador.',
      );
    }

    let unitPrice = 0;
    let totalPrice = 0;
    let configurationJson: Prisma.InputJsonValue =
      null as unknown as Prisma.InputJsonValue;
    let pricingJson: Prisma.InputJsonValue =
      null as unknown as Prisma.InputJsonValue;
    let resolvedVariantId =
      item.variantId && item.variantId.trim().length > 0
        ? item.variantId.trim()
        : null;

    if (item.configuration) {
      const quote = await this.pricingService.calculateQuote(
        item.configuration,
        PriceRuleScope.B2B,
      );
      unitPrice = quote.unitPrice;
      totalPrice = quote.total;

      const snapshotVariantId =
        typeof quote.snapshot.variantId === 'string' &&
        quote.snapshot.variantId.trim().length > 0
          ? quote.snapshot.variantId.trim()
          : null;
      resolvedVariantId =
        resolvedVariantId ??
        snapshotVariantId ??
        item.configuration.variantId ??
        null;
      const resolvedSize =
        typeof quote.snapshot.size === 'string' &&
        quote.snapshot.size.trim().length > 0
          ? quote.snapshot.size
          : (item.configuration.size ?? '');

      const configSnapshot: ConfigurationSnapshot = {
        version: '1.2',
        configCode: quote.snapshot.configCode,
        productId: item.productId,
        variantId: resolvedVariantId ?? undefined,
        productName: `Product ${item.productId}`,
        line: item.configuration.line,
        size: resolvedSize,
        material: item.configuration.material,
        quality: item.configuration.quality,
        personalizations: normalizeSnapshotPersonalizations(
          item.configuration.personalizations ?? [],
        ),
        timestamp: new Date().toISOString(),
      };

      configurationJson = {
        ...configSnapshot,
        quantity: item.quantity,
      } as unknown as Prisma.InputJsonValue;
      pricingJson = quote.snapshot as unknown as Prisma.InputJsonValue;
    }

    if (item.agreedUnitPrice !== undefined) {
      unitPrice = item.agreedUnitPrice;
      totalPrice = item.agreedUnitPrice * item.quantity;
    }

    const itemType = this.resolveItemType(item);
    const shouldReserve =
      itemType === B2BQuoteItemType.STANDARD_STOCK &&
      item.reserveStock !== false &&
      resolvedVariantId !== null;

    if (
      item.reserveStock === true &&
      itemType === B2BQuoteItemType.STANDARD_STOCK &&
      !resolvedVariantId
    ) {
      throw new BadRequestException(
        'La reserva de stock para una cotizacion B2B requiere variantId.',
      );
    }

    return {
      productId: item.productId,
      variantId: resolvedVariantId,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      configurationJson,
      pricingJson,
      itemType,
      manualSize: item.manualSize ?? null,
      manualSpecs:
        item.manualSpecs !== undefined
          ? (item.manualSpecs as Prisma.InputJsonValue)
          : (null as unknown as Prisma.InputJsonValue),
      externalUnitCost: item.externalUnitCost ?? null,
      agreedUnitPrice: item.agreedUnitPrice ?? null,
      shouldReserve,
    };
  }

  async createQuote(
    createQuoteDto: CreateQuoteDto,
    logoFile?: Express.Multer.File,
    options: CreateQuoteOptions = { allowManualItems: true },
  ) {
    let assignedPackage = this.calculatePackage(createQuoteDto.quantity);

    if (createQuoteDto.package) {
      const pkg = createQuoteDto.package;
      const qty = createQuoteDto.quantity;

      let isValid = false;
      if (pkg === B2BPackage.EMPRESA && qty >= B2B_MINIMUM_QUANTITY) {
        isValid = true;
      }
      if (pkg === B2BPackage.EVENTO && qty >= 100) isValid = true;

      if (isValid) {
        assignedPackage = pkg;
      }
    }

    let logoUrl: string | null = null;

    if (logoFile) {
      const fileName = `b2b-quotes/${Date.now()}-${logoFile.originalname.replace(/\s+/g, '-')}`;
      logoUrl = await this.storageService.uploadFile(
        'logo-corporativo',
        fileName,
        logoFile,
      );
    }

    const quoteItems = createQuoteDto.items
      ? await Promise.all(
          createQuoteDto.items.map((item) =>
            this.prepareQuoteItem(item, options),
          ),
        )
      : [];
    const reservationHours = this.getReservationHours(createQuoteDto);
    const reservationExpiresAt = new Date(
      Date.now() + reservationHours * 60 * 60 * 1000,
    );
    const hasStockReservation = quoteItems.some((item) => item.shouldReserve);

    const quote = await this.prisma.$transaction(async (tx) => {
      const createdQuote = await tx.b2BQuote.create({
        data: {
          businessName: createQuoteDto.businessName,
          quantity: Number(createQuoteDto.quantity),
          department: createQuoteDto.department,
          municipality: createQuoteDto.municipality,
          neighborhood: createQuoteDto.neighborhood,
          address: createQuoteDto.address,
          contactPhone: createQuoteDto.contactPhone,
          qrType: createQuoteDto.qrType,
          qrData: createQuoteDto.qrData,
          package: assignedPackage,
          logoUrl: logoUrl,
          size: createQuoteDto.size,
          material: createQuoteDto.material,
          reservationStatus: hasStockReservation
            ? B2BReservationStatus.ACTIVE
            : B2BReservationStatus.NONE,
          reservationHours: hasStockReservation ? reservationHours : null,
          expiresAt: hasStockReservation ? reservationExpiresAt : null,
        },
      });

      for (const item of quoteItems) {
        const createdItem = await tx.b2BQuoteItem.create({
          data: {
            quoteId: createdQuote.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            configurationJson: item.configurationJson,
            pricingJson: item.pricingJson,
            itemType: item.itemType,
            manualSize: item.manualSize,
            manualSpecs: item.manualSpecs,
            externalUnitCost: item.externalUnitCost,
            agreedUnitPrice: item.agreedUnitPrice,
            reservedQuantity: item.shouldReserve ? item.quantity : 0,
            reservationExpiresAt: item.shouldReserve
              ? reservationExpiresAt
              : null,
          },
        });

        if (item.shouldReserve && item.variantId) {
          await this.inventoryService.commitStock(
            item.variantId,
            item.quantity,
            undefined,
            undefined,
            tx,
            {
              source: 'B2B_QUOTE',
              quoteId: createdQuote.id,
              quoteItemId: createdItem.id,
              reservationExpiresAt: reservationExpiresAt.toISOString(),
            },
          );

          await tx.b2BQuoteItem.update({
            where: { id: createdItem.id },
            data: {
              reservedQuantity: item.quantity,
              reservationExpiresAt,
            },
          });
        }
      }

      return tx.b2BQuote.findUniqueOrThrow({
        where: { id: createdQuote.id },
        include: { items: true },
      });
    });

    const whatsappPayload = {
      phone: '573000000000',
      message: `Hola, soy ${createQuoteDto.businessName}. Quote ID: ${quote.id}`,
    };

    return {
      success: true,
      quote,
      whatsappPayload,
    };
  }

  async findAll() {
    const quotes = await this.prisma.b2BQuote.findMany({
      where: { deletedAt: null },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return quotes.map((quote) => ({
      ...quote,
      status: B2bService.APPROVED_DESIGN_STATUSES.has(quote.status)
        ? 'DISEÑO_APROBADO'
        : quote.status,
    }));
  }

  async approveDesign(id: string) {
    return this.prisma.b2BQuote.update({
      where: { id },
      data: { status: 'DISEÑO_APROBADO' },
    });
  }

  async expireActiveReservations(now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const expiredQuotes = await tx.b2BQuote.findMany({
        where: {
          deletedAt: null,
          reservationStatus: B2BReservationStatus.ACTIVE,
          expiresAt: { lte: now },
        },
        include: {
          items: {
            where: {
              reservedQuantity: { gt: 0 },
              reservationReleasedAt: null,
            },
          },
        },
      });

      for (const quote of expiredQuotes) {
        for (const item of quote.items) {
          if (!item.variantId || item.reservedQuantity <= 0) {
            continue;
          }

          await this.inventoryService.releaseCommittedStock(
            item.variantId,
            item.reservedQuantity,
            undefined,
            undefined,
            tx,
            {
              source: 'B2B_QUOTE',
              quoteId: quote.id,
              quoteItemId: item.id,
              reservationReleasedAt: now.toISOString(),
            },
          );

          await tx.b2BQuoteItem.update({
            where: { id: item.id },
            data: { reservationReleasedAt: now },
          });
        }

        await tx.b2BQuote.update({
          where: { id: quote.id },
          data: {
            reservationStatus: B2BReservationStatus.EXPIRED,
            reservationReleasedAt: now,
          },
        });
      }

      return { expiredCount: expiredQuotes.length };
    });
  }
}
