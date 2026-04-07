import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { WizardCategory } from '../../../generated/client/enums';

export class CreateWizardOptionDto {
  @IsEnum(WizardCategory)
  @IsNotEmpty()
  category: WizardCategory;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  basePriceModifier?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedMaterialValues?: string[];

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
