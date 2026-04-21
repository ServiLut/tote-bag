import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { normalizeDecimalInput } from '../../purchases/dto/decimal-input.util';

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class FixedExpenseConfigItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  label!: string;

  @Transform(({ value }) => normalizeDecimalInput(value))
  @Matches(DECIMAL_PATTERN, {
    message: 'El gasto fijo debe ser un valor decimal positivo',
  })
  amount!: string;
}

export class UpdateFixedExpensesConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FixedExpenseConfigItemDto)
  items!: FixedExpenseConfigItemDto[];
}
