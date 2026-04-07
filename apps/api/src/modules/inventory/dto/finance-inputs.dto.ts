import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class CreateSupplierPaymentDto {
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nit?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class CreateOpexDto {
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  opexCategoryId: string;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

export class CreateOpexCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
