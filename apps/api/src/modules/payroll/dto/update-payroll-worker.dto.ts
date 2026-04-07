import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PayrollWorkerType } from '../../../generated/client/client';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class UpdatePayrollWorkerDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PayrollWorkerType)
  workerType?: PayrollWorkerType;

  @IsOptional()
  @IsString()
  roleName?: string;

  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return typeof value === 'boolean' ? value : undefined;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
