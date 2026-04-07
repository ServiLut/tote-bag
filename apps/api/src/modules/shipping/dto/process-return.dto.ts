import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export enum ReturnProductCondition {
  PERFECT = 'PERFECT',
  DAMAGED = 'DAMAGED',
  USED = 'USED',
}

export enum ReturnReason {
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  CUSTOMER_REJECTED = 'CUSTOMER_REJECTED',
  DEFECTIVE_PRODUCT = 'DEFECTIVE_PRODUCT',
}

export class ProcessReturnDto {
  @ApiProperty({ enum: ReturnProductCondition })
  @IsEnum(ReturnProductCondition)
  productCondition!: ReturnProductCondition;

  @ApiProperty({ example: false })
  @IsBoolean()
  restock!: boolean;

  @ApiProperty({ enum: ReturnReason })
  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @ApiProperty({ example: 'RET-123456', required: false })
  @ValidateIf((dto: ProcessReturnDto) => dto.returnTrackingNumber !== undefined)
  @IsString()
  @IsOptional()
  returnTrackingNumber?: string;
}
