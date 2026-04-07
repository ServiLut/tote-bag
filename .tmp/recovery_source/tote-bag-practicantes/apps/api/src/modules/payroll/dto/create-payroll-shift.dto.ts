import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class CreatePayrollShiftDto {
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsInt()
  @Min(1)
  workerId?: number;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  collaborator?: string;

  @IsDateString()
  workDate: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}
