import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { normalizeDecimalInput } from './decimal-input.util';

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

export class UpdatePurchaseInvoiceDto {
  @AtLeastOneDefined(['supplierId', 'totalAmount', 'issueDate'], {
    message:
      'Debes indicar al menos uno de los campos supplierId, totalAmount o issueDate',
  })
  readonly updateReference?: never;

  @IsOptional()
  @Transform(({ value }) => normalizeDecimalInput(value))
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'totalAmount debe ser un decimal valido con hasta 2 decimales',
  })
  totalAmount?: string;

  @IsOptional()
  @IsISO8601()
  issueDate?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
