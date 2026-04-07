import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class UpdatePersonalizationDto {
  @IsNumber()
  @IsOptional()
  basePrice?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedMaterialValues?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
