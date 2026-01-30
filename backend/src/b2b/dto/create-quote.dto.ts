import { IsString, IsInt, IsEnum, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export enum QrType {
  WHATSAPP = 'WHATSAPP',
  WEB = 'WEB',
  INSTAGRAM = 'INSTAGRAM',
}

export class CreateQuoteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsEnum(QrType)
  qrType: QrType;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;
}
