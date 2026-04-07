import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const PQRS_STATUSES = [
  'NUEVO',
  'EN_REVISION',
  'RESPONDIDO',
  'CERRADO',
] as const;

export class UpdatePqrsTicketDto {
  @IsIn(PQRS_STATUSES)
  status: (typeof PQRS_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminResponse?: string;
}
