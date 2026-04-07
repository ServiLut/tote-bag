import { IsOptional, IsString } from 'class-validator';
import { ProductConfigInputDto } from '../../../common/dto/product-config.dto';

export class CreatePersonalizationRequestDto extends ProductConfigInputDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
