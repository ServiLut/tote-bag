import { IsIn, IsOptional } from 'class-validator';

const PQRS_STATUSES = [
  'NUEVO',
  'EN_REVISION',
  'RESPONDIDO',
  'CERRADO',
] as const;

export class FindPqrsDto {
  @IsOptional()
  @IsIn(PQRS_STATUSES)
  status?: (typeof PQRS_STATUSES)[number];
}
