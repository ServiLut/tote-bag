import { Controller, Get, Header, Param } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';

@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get('products/:slug')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  async getProductConfig(@Param('slug') slug: string) {
    return this.configurationService.getProductConfig(slug);
  }

  @Get('options/:productId')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Tue, 30 Jun 2026 23:59:59 GMT')
  async getAvailableOptions(@Param('productId') productId: string) {
    return this.configurationService.getAvailableOptions(productId);
  }
}
