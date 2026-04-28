import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class ApprovePersonalizationRequestDto {
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  @IsPositive()
  approvedUnitPrice?: number;

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}
