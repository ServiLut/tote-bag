import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';
import { BatchInputStatus } from './create-purchase-batch.dto';

export class UpdatePurchaseBatchDto {
  @IsString()
  supplierId: string;

  @IsString()
  productId: string;

  @IsString()
  variantId: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  quantityReceived: number;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  unitCost: number;

  @IsEnum(BatchInputStatus)
  status: BatchInputStatus;

  @IsOptional()
  @IsString()
  purchaseDate?: string;
}
