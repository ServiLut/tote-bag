import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ShipmentStatus } from '../../../generated/client/client';
import { parseLocalizedNumber } from '../../../common/utils/parse-localized-number';

export class UpdateShipmentDto {
  @ApiProperty({ enum: ShipmentStatus, required: false })
  @IsEnum(ShipmentStatus)
  @IsOptional()
  status?: ShipmentStatus;

  @ApiProperty({ example: 'TRK123456', required: false })
  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @ApiProperty({ example: '2026-03-15T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  estimatedDelivery?: string;

  @ApiProperty({ example: 'provider-uuid', required: false })
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiProperty({ example: 1.5, required: false })
  @IsOptional()
  @Transform(({ value }) => parseLocalizedNumber(value))
  @IsNumber()
  weight?: number;

  @ApiProperty({ example: '30x20x10 cm', required: false })
  @IsString()
  @IsOptional()
  dimensions?: string;
}
