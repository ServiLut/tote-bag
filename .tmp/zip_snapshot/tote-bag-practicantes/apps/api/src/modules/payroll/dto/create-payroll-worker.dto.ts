import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PayrollWorkerType } from '../../../generated/client/client';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class CreatePayrollWorkerDto {
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

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
  @IsNumber()
  @Min(0)
  hourlyRate: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
