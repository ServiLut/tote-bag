import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateManagerApprovalDto {
  @IsString()
  resource: string;

  @IsString()
  action: string;

  @IsString()
  entity: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestedByUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  expiresInMinutes?: number;
}
