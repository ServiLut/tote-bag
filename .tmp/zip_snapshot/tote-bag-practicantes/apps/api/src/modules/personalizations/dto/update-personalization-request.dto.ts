import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PersonalizationRequestStatus } from '../../../generated/client/enums';

export class UpdatePersonalizationRequestDto {
  @IsEnum(PersonalizationRequestStatus)
  @IsOptional()
  status?: PersonalizationRequestStatus;

  @IsString()
  @IsOptional()
  reviewNotes?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
