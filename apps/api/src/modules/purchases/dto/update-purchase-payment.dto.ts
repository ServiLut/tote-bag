import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
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

function AtLeastOneDefined(
  propertyNames: string[],
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'atLeastOneDefined',
      target: object.constructor,
      propertyName,
      constraints: [propertyNames],
      options: validationOptions,
      validator: {
        validate(_: unknown, args: ValidationArguments) {
          const [keys] = args.constraints as [string[]];
          const dto = args.object as Record<string, unknown>;

          return keys.some((key) => {
            const value = dto[key];

            if (typeof value === 'string') {
              return value.trim().length > 0;
            }

            return value !== null && value !== undefined;
          });
        },
      },
    });
  };
}

export class UpdatePurchasePaymentDto {
  @AtLeastOneDefined(['amount', 'paymentDate', 'proofUrl'], {
    message:
      'Debes indicar al menos uno de los campos amount, paymentDate o proofUrl',
  })
  readonly updateReference?: never;

  @IsOptional()
  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount debe ser un decimal valido con hasta 2 decimales',
  })
  amount?: string;

  @IsOptional()
  @IsISO8601()
  paymentDate?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @Matches(/^(https?:\/\/|private:\/\/).+/, {
    message: 'proofUrl debe ser una URL valida o referencia privada',
  })
  proofUrl?: string;
}
