import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

export enum B2BPackage {
  STARTER = 'Starter',
  PRO = 'Pro',
  EVENTO = 'Evento',
}

@Injectable()
export class B2bService {
  constructor(private readonly prisma: PrismaService) {}

  calculatePackage(quantity: number): B2BPackage {
    if (quantity < 50) return B2BPackage.STARTER;
    if (quantity <= 200) return B2BPackage.PRO;
    return B2BPackage.EVENTO;
  }

  async createQuote(
    createQuoteDto: CreateQuoteDto,
    logoFile?: Express.Multer.File,
  ) {
    const assignedPackage = this.calculatePackage(createQuoteDto.quantity);

    // Simulate logo URL
    const logoUrl = logoFile
      ? `https://fake-storage.com/${logoFile.originalname}`
      : null;

    const quote = await this.prisma.b2BQuote.create({
      data: {
        businessName: createQuoteDto.businessName,
        quantity: createQuoteDto.quantity,
        department: createQuoteDto.department,
        municipality: createQuoteDto.municipality,
        neighborhood: createQuoteDto.neighborhood,
        address: createQuoteDto.address,
        contactPhone: createQuoteDto.contactPhone,
        qrType: createQuoteDto.qrType,
        qrData: createQuoteDto.qrData,
        package: assignedPackage,
        logoUrl: logoUrl,
      },
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
    return this.prisma.b2BQuote.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveDesign(id: string) {
    return this.prisma.b2BQuote.update({
      where: { id },
      data: { status: 'DISEÑO_APROBADO' },
    });
  }
}
