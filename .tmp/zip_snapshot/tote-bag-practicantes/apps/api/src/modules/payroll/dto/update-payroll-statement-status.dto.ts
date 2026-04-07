import { IsEnum } from 'class-validator';
import { PayrollStatementStatus } from '../../../generated/client/client';

export class UpdatePayrollStatementStatusDto {
  @IsEnum(PayrollStatementStatus)
  status: PayrollStatementStatus;
}
