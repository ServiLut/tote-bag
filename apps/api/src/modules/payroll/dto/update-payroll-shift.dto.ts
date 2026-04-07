import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class UpdatePayrollShiftDto {
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsInt()
  @Min(1)
  workerId?: number;

  @IsOptional()
  @IsString()
  collaborator?: string;

  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}
