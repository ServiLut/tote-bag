import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { FinanceService } from './finance.service';
import { ReportingService } from './reporting.service';
import { InventoryController } from './inventory.controller';
import { ReportingController } from './reporting.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, ReportingController],
  providers: [InventoryService, FinanceService, ReportingService],
  exports: [InventoryService, FinanceService, ReportingService],
})
export class InventoryModule {}
