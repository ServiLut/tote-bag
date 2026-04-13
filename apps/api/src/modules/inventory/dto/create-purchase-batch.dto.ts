import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export enum BatchInputStatus {
  RECIBIDO = 'RECIBIDO',
  PENDIENTE = 'PENDIENTE',
}

export enum PurchaseDocumentTypeInput {
  INVOICE = 'INVOICE',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
}

export class PurchaseBatchItemDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  cantidad: number;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  costoUnitario: number;
}

export class CreatePurchaseBatchDto {
  @IsString()
  supplierId: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  totalCost: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  freightCost?: number;

  @IsEnum(BatchInputStatus)
  status: BatchInputStatus;

  @IsOptional()
  @IsEnum(PurchaseDocumentTypeInput)
  documentType?: PurchaseDocumentTypeInput;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseBatchItemDto)
  items: PurchaseBatchItemDto[];

  // Mantener estos para compatibilidad si es necesario, pero el nuevo método usará 'items'
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  quantityReceived?: number;
}
