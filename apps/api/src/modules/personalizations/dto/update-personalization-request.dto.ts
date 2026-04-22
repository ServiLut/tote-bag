import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PersonalizationRequestStatus } from '../../../generated/client/enums';
import { CreatePersonalizationRequestDto } from './create-personalization-request.dto';

export class UpdatePersonalizationRequestDto extends PartialType(
  CreatePersonalizationRequestDto,
) {
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
