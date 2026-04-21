import { IsArray, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class GatewayMarginGridDto {
  @IsNumber()
  @Min(0.01)
  grossAmount: number;

  @IsNumber()
  @Min(0)
  productCost: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  taxRate?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  targetMargins?: number[];
}
