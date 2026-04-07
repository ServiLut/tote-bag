import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  ValidateNested,
  IsArray,
  IsOptional,
  IsBoolean,
  Min,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductConfigInputDto } from '../../../common/dto/product-config.dto';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

class AddressDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}

class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  @Transform(({ value }) => parseLocalizedNumber(value))
  quantity: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  price?: number;

  @ValidateNested()
  @Type(() => ProductConfigInputDto)
  @IsOptional()
  configuration?: ProductConfigInputDto;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsNotEmpty()
  shippingAddress: AddressDto;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  profileId?: string;

  @IsOptional()
  @IsString()
  shippingProviderId?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isB2B: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isManual: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['ECOMMERCE', 'MANUAL'])
  source?: string;

  @IsOptional()
  @IsString()
  initialStatus?: string;

  @IsOptional()
  @IsIn(['amount', 'percent'])
  manualDiscountType?: 'amount' | 'percent';

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : parseLocalizedNumber(value),
  )
  @IsNumber()
  @Min(0)
  manualDiscountValue?: number;

  @IsOptional()
  configurationJson?: any;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
