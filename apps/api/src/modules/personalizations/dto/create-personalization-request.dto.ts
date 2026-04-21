import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ProductConfigInputDto } from '../../../common/dto/product-config.dto';

export class CreatePersonalizationRequestDto extends ProductConfigInputDto {
  @IsUUID('4')
  @IsOptional()
  profileId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
