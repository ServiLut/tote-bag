import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export enum NonCommercialInventoryOutputReasonInput {
  GIFT = 'GIFT',
  SAMPLE = 'SAMPLE',
  INTERNAL_TEST = 'INTERNAL_TEST',
  OPERATIONAL_USE = 'OPERATIONAL_USE',
  OTHER = 'OTHER',
}

export class CreateNonCommercialInventoryOutputDto {
  @IsString()
  variantId: string;

  @IsNumber()
  @Transform(({ value }) => parseLocalizedNumber(value))
  quantity: number;

  @IsEnum(NonCommercialInventoryOutputReasonInput)
  reason: NonCommercialInventoryOutputReasonInput;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  supportUrl?: string;
}
