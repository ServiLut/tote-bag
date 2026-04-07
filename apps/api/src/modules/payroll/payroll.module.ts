import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { PayrollController } from './payroll.controller';
import { PayrollPdfService } from './payroll.pdf.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [PrismaModule, StorageModule, RolesModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollPdfService],
  exports: [PayrollService],
})
export class PayrollModule {}
