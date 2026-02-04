import {
  IsString,
  IsInt,
  IsEnum,
  Min,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum QrType {
  WHATSAPP = 'WHATSAPP',
  WEB = 'WEB',
  INSTAGRAM = 'INSTAGRAM',
}

export enum B2BPackage {
  STARTER = 'Starter',
  PRO = 'Pro',
  EVENTO = 'Evento',
}

export class CreateQuoteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  municipality: string;

  @IsString()
  @IsNotEmpty()
  neighborhood: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsEnum(QrType)
  qrType: QrType;

  @IsString()
  @IsNotEmpty()
  qrData: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @IsOptional()
  @IsEnum(B2BPackage)
  package?: B2BPackage;
}
