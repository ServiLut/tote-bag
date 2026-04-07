import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ShippingModule } from '../shipping/shipping.module';
import { OrdersModule } from '../orders/orders.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [PrismaModule, ConfigModule, ShippingModule, OrdersModule, RolesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
