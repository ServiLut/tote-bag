import { IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShippingProviderDto {
  @ApiProperty({ example: 'Servientrega' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'juan@servientrega.com', required: false })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ example: 'sk_test_123', required: false })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
