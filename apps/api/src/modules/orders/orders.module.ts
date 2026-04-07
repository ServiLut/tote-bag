import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RolesModule } from '../roles/roles.module';
import { ReceiptPdfService } from './orders.pdf.service';
import { ShippingModule } from '../shipping/shipping.module';
import { OrderMaintenanceService } from './order-maintenance.service';

@Module({
  imports: [
    PrismaModule,
    PricingModule,
    InventoryModule,
    RolesModule,
    ShippingModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, ReceiptPdfService, OrderMaintenanceService],
  exports: [OrdersService, ReceiptPdfService],
})
export class OrdersModule {}
