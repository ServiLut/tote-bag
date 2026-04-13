import { Module } from '@nestjs/common';
import { ShippingNotifierService } from './shipping-notifier.service';
import { ShippingService } from './shipping.service';
import { ShippingPdfService } from './shipping.pdf.service';
import { ShippingSyncService } from './shipping-sync.service';
import { ShippingController } from './shipping.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PrismaModule, RolesModule, InventoryModule],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    ShippingPdfService,
    ShippingNotifierService,
    ShippingSyncService,
  ],
  exports: [ShippingService, ShippingPdfService, ShippingSyncService],
})
export class ShippingModule {}
