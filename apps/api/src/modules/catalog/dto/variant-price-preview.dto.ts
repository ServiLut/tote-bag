import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class VariantPricePreviewDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  netPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  taxRate: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  cost?: number | null;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  costPrice?: number | null;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  totalCost?: number | null;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  costTotal?: number | null;
}
