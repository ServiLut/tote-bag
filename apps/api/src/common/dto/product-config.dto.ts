import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PersonalizationInputDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];
}

export class ProductConfigInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  // Commercial source of truth for operational flows. The sellable reference
  // must be explicit whenever pricing or stock depends on the variant.
  variantId: string;

  @IsString()
  @IsNotEmpty()
  line: string;

  @IsString()
  @IsOptional()
  // Keep as descriptive context for snapshots and UX, not for commercial
  // resolution.
  size?: string;

  @IsString()
  @IsNotEmpty()
  material: string;

  @IsString()
  @IsOptional()
  quality?: string;

  @IsString()
  @IsOptional()
  customImageURL?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  simulatedPvp?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonalizationInputDto)
  @IsOptional()
  personalizations?: PersonalizationInputDto[];
}
