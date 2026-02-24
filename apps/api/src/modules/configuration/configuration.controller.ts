import { Controller, Get, Param } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';

@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get('products/:slug')
  async getProductConfig(@Param('slug') slug: string) {
    return this.configurationService.getProductConfig(slug);
  }

  @Get('options/:productId')
  async getAvailableOptions(@Param('productId') productId: string) {
    return this.configurationService.getAvailableOptions(productId);
  }
}
