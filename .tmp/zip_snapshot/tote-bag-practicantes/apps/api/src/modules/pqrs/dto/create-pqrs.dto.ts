import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const PQRS_TYPES = ['PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA'] as const;

export class CreatePqrsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsIn(PQRS_TYPES)
  type: (typeof PQRS_TYPES)[number];

  @IsString()
  @MinLength(4)
  @MaxLength(160)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderNumber?: string;
}
