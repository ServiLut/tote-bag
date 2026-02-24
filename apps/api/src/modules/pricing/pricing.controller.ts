import { Controller, Post, Body, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ProductConfigInputDto } from '../../common/dto/product-config.dto';
import { PricingScope } from '../../generated/client/enums';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('quote')
  async calculateQuote(
    @Body() config: ProductConfigInputDto,
    @Query('scope') scope: PricingScope = PricingScope.B2C
  ) {
    return this.pricingService.calculateQuote(config, scope);
  }
}
