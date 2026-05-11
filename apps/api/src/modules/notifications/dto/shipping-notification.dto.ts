import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ShippingNotificationOrderDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsInt()
  orderNumber: number;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  trackingNumber?: string | null;
}

export class ShippingNotificationCustomerDto {
  @IsEmail()
  email: string;
}

export class ShippingNotificationDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsISO8601()
  occurredAt: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingNotificationOrderDto)
  order: ShippingNotificationOrderDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingNotificationCustomerDto)
  customer: ShippingNotificationCustomerDto;
}
