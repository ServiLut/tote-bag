import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RolesModule } from '../roles/roles.module';
import { ReceiptPdfService } from './orders.pdf.service';

@Module({
  imports: [PrismaModule, PricingModule, InventoryModule, RolesModule],
  controllers: [OrdersController],
  providers: [OrdersService, ReceiptPdfService],
  exports: [OrdersService, ReceiptPdfService],
})
export class OrdersModule {}
