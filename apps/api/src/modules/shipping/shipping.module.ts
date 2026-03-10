import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingPdfService } from './shipping.pdf.service';
import { ShippingController } from './shipping.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [PrismaModule, RolesModule],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingPdfService],
  exports: [ShippingService, ShippingPdfService],
})
export class ShippingModule {}
