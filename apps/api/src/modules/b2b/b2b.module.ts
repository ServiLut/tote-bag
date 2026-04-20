import { Module } from '@nestjs/common';
import { B2bService } from './b2b.service';
import { B2bController } from './b2b.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { B2BQuoteMaintenanceService } from './b2b-maintenance.service';

@Module({
  imports: [PrismaModule, PricingModule, InventoryModule],
  controllers: [B2bController],
  providers: [B2bService, B2BQuoteMaintenanceService],
})
export class B2BModule {}
