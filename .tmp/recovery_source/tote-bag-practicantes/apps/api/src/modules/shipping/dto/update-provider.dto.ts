import { PartialType } from '@nestjs/swagger';
import { CreateShippingProviderDto } from './create-provider.dto';

export class UpdateShippingProviderDto extends PartialType(
  CreateShippingProviderDto,
) {}
