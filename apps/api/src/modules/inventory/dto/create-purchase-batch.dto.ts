import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BatchInputStatus {
  RECIBIDO = 'RECIBIDO',
  PENDIENTE = 'PENDIENTE',
}

export class PurchaseBatchItemDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsNumber()
  cantidad: number;

  @IsNumber()
  costoUnitario: number;
}

export class CreatePurchaseBatchDto {
  @IsString()
  supplierId: string;

  @IsNumber()
  totalCost: number;

  @IsString()
  status: string;

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

  @IsNumber()
  @IsOptional()
  quantityReceived?: number;
}
