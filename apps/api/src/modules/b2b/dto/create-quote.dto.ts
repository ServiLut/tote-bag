import {
  IsString,
  IsInt,
  IsEnum,
  Min,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductConfigInputDto } from '../../../common/dto/product-config.dto';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export enum QrType {
  WHATSAPP = 'WHATSAPP',
  WEB = 'WEB',
  INSTAGRAM = 'INSTAGRAM',
}

export enum B2BPackage {
  EMPRESA = 'Empresa',
  EVENTO = 'Evento',
}

export enum B2BQuoteItemTypeInput {
  STANDARD_STOCK = 'STANDARD_STOCK',
  MANUAL_EXTERNAL_PRODUCTION = 'MANUAL_EXTERNAL_PRODUCTION',
}

export const B2B_MINIMUM_QUANTITY = 50;

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

  @IsOptional()
  @IsEnum(B2BQuoteItemTypeInput)
  itemType?: B2BQuoteItemTypeInput;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  manualSize?: string;

  @IsOptional()
  manualSpecs?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  externalUnitCost?: number;

  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  agreedUnitPrice?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  reserveStock?: boolean;
}

export class CreateQuoteDto {
  @Type(() => Number)
  @IsInt()
  @Min(B2B_MINIMUM_QUANTITY)
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
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsEnum(B2BPackage)
  package?: B2BPackage;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  @IsOptional()
  items?: CreateQuoteItemDto[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  reservationHours?: number;
}
