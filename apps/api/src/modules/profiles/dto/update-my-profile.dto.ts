import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return value;
}

export class UpdateMyProfileDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(120)
  firstName?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'El telefono del perfil no es valido.',
  })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(120)
  department?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(120)
  municipality?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(120)
  neighborhood?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  municipalityId?: string | null;
}
