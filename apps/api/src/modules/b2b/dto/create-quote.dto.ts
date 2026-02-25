import {
  IsString,
  IsInt,
  IsEnum,
  Min,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductConfigInputDto } from '../../../common/dto/product-config.dto';

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

export class CreateQuoteItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @ValidateNested()
  @Type(() => ProductConfigInputDto)
  @IsOptional()
  configuration?: ProductConfigInputDto;
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  @IsOptional()
  items?: CreateQuoteItemDto[];
}
