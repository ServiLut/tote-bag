import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto, B2BPackage } from './dto/create-quote.dto';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class B2bService {
  private supabase: ReturnType<typeof createClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SERVICE_ROLE') ||
      this.configService.get<string>('SUPABASE_KEY') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase URL or Key is missing in environment variables. Please check SUPABASE_URL and SUPABASE_KEY.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  calculatePackage(quantity: number): B2BPackage {
    if (quantity < 50) return B2BPackage.STARTER;
    if (quantity <= 200) return B2BPackage.PRO;
    return B2BPackage.EVENTO;
  }

  async createQuote(
    createQuoteDto: CreateQuoteDto,
    logoFile?: Express.Multer.File,
  ) {
    let assignedPackage = this.calculatePackage(createQuoteDto.quantity);

    // Validate manual package selection if provided
    if (createQuoteDto.package) {
      const pkg = createQuoteDto.package;
      const qty = createQuoteDto.quantity;

      let isValid = false;
      if (pkg === B2BPackage.STARTER && qty >= 12) isValid = true;
      if (pkg === B2BPackage.PRO && qty >= 50) isValid = true;
      if (pkg === B2BPackage.EVENTO && qty >= 200) isValid = true;

      if (isValid) {
        assignedPackage = pkg;
      }
    }

    let logoUrl: string | null = null;

    if (logoFile) {
      const fileName = `b2b-quotes/${Date.now()}-${logoFile.originalname.replace(/\s+/g, '-')}`;

      const { error } = await this.supabase.storage
        .from('logo-corporativo')
        .upload(fileName, logoFile.buffer, {
          contentType: logoFile.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Supabase Upload Error:', error);
        throw new InternalServerErrorException('Error uploading logo');
      }

      const { data: publicUrlData } = this.supabase.storage
        .from('logo-corporativo')
        .getPublicUrl(fileName);

      logoUrl = publicUrlData.publicUrl;
    }

    const quote = await this.prisma.b2BQuote.create({
      data: {
        businessName: createQuoteDto.businessName,
        quantity: Number(createQuoteDto.quantity), // Ensure quantity is a number
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
