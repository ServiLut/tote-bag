import { Module } from '@nestjs/common';
import { B2bService } from './b2b.service';
import { B2bController } from './b2b.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PrismaModule, PricingModule],
  controllers: [B2bController],
  providers: [B2bService],
})
export class B2BModule {}
