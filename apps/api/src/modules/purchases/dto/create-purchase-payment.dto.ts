import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { normalizeDecimalInput } from './decimal-input.util';

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  return value;
}

export class CreatePurchasePaymentDto {
  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount debe ser un decimal valido con hasta 2 decimales',
  })
  amount: string;

  @IsISO8601()
  paymentDate: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @Matches(/^(https?:\/\/|private:\/\/).+/, {
    message: 'proofUrl debe ser una URL valida o referencia privada',
  })
  proofUrl?: string;
}
