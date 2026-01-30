import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../generated/client/enums';

export class UpdateOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  carrier?: string;
}
