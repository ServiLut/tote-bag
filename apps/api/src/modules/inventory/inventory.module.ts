import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ReportingService } from './reporting.service';
import { InventoryController } from './inventory.controller';
import { ReportingController } from './reporting.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [InventoryController, ReportingController, FinanceController],
  providers: [InventoryService, FinanceService, ReportingService],
  exports: [InventoryService, FinanceService, ReportingService],
})
export class InventoryModule {}
