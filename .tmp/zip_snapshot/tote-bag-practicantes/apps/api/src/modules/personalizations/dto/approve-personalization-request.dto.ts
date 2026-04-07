import { IsString, IsOptional } from 'class-validator';

export class ApprovePersonalizationRequestDto {
  @IsString()
  @IsOptional()
  reviewNotes?: string;
}
