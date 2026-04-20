import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
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

export enum PurchaseBatchLineItemTypeInput {
  VARIANT = 'VARIANT',
  SUPPLY = 'SUPPLY',
  TOOL = 'TOOL',
  OTHER = 'OTHER',
}

export enum InventoryAdjustmentItemTypeInput {
  VARIANT = 'VARIANT',
  SUPPLY = 'SUPPLY',
}

export enum InventoryAdjustmentReasonInput {
  ENTRADA_MAQUILA = 'ENTRADA_MAQUILA',
  SALIDA_MUESTRA_PUBLICIDAD = 'SALIDA_MUESTRA_PUBLICIDAD',
  SALIDA_AVERIA = 'SALIDA_AVERIA',
  AJUSTE_VENTA_EXTERNA = 'AJUSTE_VENTA_EXTERNA',
}

export class PurchaseBatchItemDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsEnum(PurchaseBatchLineItemTypeInput)
  @IsOptional()
  itemType?: PurchaseBatchLineItemTypeInput;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  supplyItemId?: string;

  @IsString()
  @IsOptional()
  itemName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  cantidad: number;

  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  costoUnitario: number;

  @IsString()
  @IsOptional()
  notes?: string;
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

  @IsOptional()
  @IsString()
  supportUrl?: string;

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

export class CreateSupplyItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  unitOfMeasure: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  cost?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  stock?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  minStock?: number;
}

export class CreateInventoryAdjustmentDto {
  @IsEnum(InventoryAdjustmentReasonInput)
  reason: InventoryAdjustmentReasonInput;

  @IsEnum(InventoryAdjustmentItemTypeInput)
  itemType: InventoryAdjustmentItemTypeInput;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  supplyItemId?: string;

  @IsString()
  purchaseBatchLineId: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  quantityDelta: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateReorderPointDto {
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  reorderPoint?: number;
}
