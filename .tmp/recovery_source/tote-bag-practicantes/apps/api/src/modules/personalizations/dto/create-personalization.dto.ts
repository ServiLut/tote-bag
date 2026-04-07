import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreatePersonalizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsNotEmpty()
  basePrice: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedMaterialValues?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
