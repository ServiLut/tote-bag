import { IsIn, IsString } from 'class-validator';

export const B2B_QUOTE_MANAGED_STATUSES = [
  'PENDIENTE',
  'DISE\u00d1O_APROBADO',
  'CANCELADO',
] as const;

export type B2BQuoteManagedStatus = (typeof B2B_QUOTE_MANAGED_STATUSES)[number];

export class UpdateQuoteStatusDto {
  @IsString()
  @IsIn(B2B_QUOTE_MANAGED_STATUSES)
  status!: B2BQuoteManagedStatus;
}
