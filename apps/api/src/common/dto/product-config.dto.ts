import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductLine {
  BASICA = 'BASICA',
  ESTANDAR = 'ESTANDAR',
  PREMIUM = 'PREMIUM',
}

export class PersonalizationInputDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  options: string[];
}

export class ProductConfigInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsEnum(ProductLine)
  @IsNotEmpty()
  line: ProductLine;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  material: string;

  @IsString()
  @IsNotEmpty()
  quality: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonalizationInputDto)
  personalizations: PersonalizationInputDto[];
}
