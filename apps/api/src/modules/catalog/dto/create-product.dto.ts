import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsBoolean,
  Matches,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ProductStatus,
  PrintType,
  AttributeType,
  PriceRuleScope,
} from '../../../generated/client/enums';

export class CreateProductImageDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  alt?: string;

  @IsNumber()
  @IsOptional()
  position?: number;
}

export class CreateVariantDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, {
    message:
      'El SKU solo puede contener letras, numeros, puntos, guiones, slash o underscore.',
  })
  sku?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsNumber()
  @Min(0)
  minPrice: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  comparePrice?: number;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  taxRate?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProductAttributeDto {
  @IsEnum(AttributeType)
  type: AttributeType;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsNumber()
  priceModifier: number;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreatePricingRuleDto {
  @IsEnum(PriceRuleScope)
  scope: PriceRuleScope;

  @IsNumber()
  @Min(1)
  minQty: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxQty?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  fixedUnitPrice?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  basePrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  comparePrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsString()
  @IsOptional()
  collectionId?: string;

  @IsString()
  @IsOptional()
  collectionName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  @IsOptional()
  images?: CreateProductImageDto[];

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsNotEmpty()
  deliveryTime: string;

  @IsString()
  @IsOptional()
  material?: string;

  @IsString()
  @IsOptional()
  dimensions?: string;

  @IsString()
  @IsOptional()
  careInstructions?: string;

  @IsEnum(PrintType)
  @IsOptional()
  printType?: PrintType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  @IsOptional()
  attributes?: CreateProductAttributeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePricingRuleDto)
  @IsOptional()
  pricingRules?: CreatePricingRuleDto[];
}
