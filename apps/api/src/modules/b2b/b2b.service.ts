import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuoteDto, B2BPackage } from './dto/create-quote.dto';
import { PricingService } from '../pricing/pricing.service';
import { PriceRuleScope } from '../../generated/client/enums';
import { Prisma } from '../../generated/client/client';
import {
  ConfigurationSnapshot,
  normalizeSnapshotPersonalizations,
} from '../../common/interfaces/snapshots.interface';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class B2bService {
  private static readonly APPROVED_DESIGN_STATUSES = new Set([
    'DISEÑO_APROBADO',
    'DISEÃ‘O_APROBADO',
    'DISEÃƒâ€˜O_APROBADO',
    'DISEÃƒÆ’Ã¢â‚¬ËœO_APROBADO',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    private readonly storageService: StorageService,
  ) {}

  calculatePackage(quantity: number): B2BPackage {
    if (quantity < 100) return B2BPackage.EMPRESA;
    return B2BPackage.EVENTO;
  }

  async createQuote(
    createQuoteDto: CreateQuoteDto,
    logoFile?: Express.Multer.File,
  ) {
    let assignedPackage = this.calculatePackage(createQuoteDto.quantity);

    if (createQuoteDto.package) {
      const pkg = createQuoteDto.package;
      const qty = createQuoteDto.quantity;

      let isValid = false;
      if (pkg === B2BPackage.EMPRESA && qty >= 30) isValid = true;
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
          createQuoteDto.items.map(async (item) => {
            let unitPrice = 0;
            let totalPrice = 0;
            let configurationJson: Prisma.InputJsonValue | undefined =
              undefined;
            let pricingJson: Prisma.InputJsonValue | undefined = undefined;

            if (item.configuration) {
              const quote = await this.pricingService.calculateQuote(
                item.configuration,
                PriceRuleScope.B2B,
              );
              unitPrice = quote.unitPrice;
              totalPrice = quote.total;

              const configSnapshot: ConfigurationSnapshot = {
                version: '1.1',
                configCode: quote.snapshot.configCode,
                productId: item.productId,
                productName: `Product ${item.productId}`,
                line: item.configuration.line,
                size: item.configuration.size,
                material: item.configuration.material,
                quality: item.configuration.quality,
                personalizations: normalizeSnapshotPersonalizations(
                  item.configuration.personalizations,
                ),
                timestamp: new Date().toISOString(),
              };

              configurationJson =
                configSnapshot as unknown as Prisma.InputJsonValue;
              pricingJson = quote.snapshot as unknown as Prisma.InputJsonValue;
            }

            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice,
              totalPrice,
              configurationJson:
                configurationJson ?? (null as unknown as Prisma.InputJsonValue),
              pricingJson:
                pricingJson ?? (null as unknown as Prisma.InputJsonValue),
            };
          }),
        )
      : [];

    const quote = await this.prisma.b2BQuote.create({
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
        items: {
          create: quoteItems,
        },
      },
      include: { items: true },
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
}
