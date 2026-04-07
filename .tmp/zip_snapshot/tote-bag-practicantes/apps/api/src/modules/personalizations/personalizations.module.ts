import { Module } from '@nestjs/common';
import { PersonalizationsService } from './personalizations.service';
import { PersonalizationsController } from './personalizations.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [PrismaModule, PricingModule, OrdersModule],
  controllers: [PersonalizationsController],
  providers: [PersonalizationsService],
})
export class PersonalizationsModule {}
