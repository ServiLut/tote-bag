import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { normalizeDecimalInput } from '../../purchases/dto/decimal-input.util';

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class BreakEvenFixedExpenseDto {
  @IsOptional()
  @IsString()
  label?: string;

  @Transform(({ value }) => normalizeDecimalInput(value))
  @Matches(DECIMAL_PATTERN, {
    message: 'El gasto fijo debe ser un valor decimal positivo',
  })
  amount!: string;
}

export class BreakEvenSimulationDto {
  @IsOptional()
  @Transform(({ value }) => normalizeDecimalInput(value))
  @Matches(DECIMAL_PATTERN, {
    message: 'El total de gastos fijos debe ser un valor decimal positivo',
  })
  fixedExpensesTotal?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakEvenFixedExpenseDto)
  fixedExpenses?: BreakEvenFixedExpenseDto[];

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
