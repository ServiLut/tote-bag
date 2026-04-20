import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { ManagerApprovalsController } from './manager-approvals.controller';
import { ManagerApprovalsService } from './manager-approvals.service';

@Global()
@Module({
  imports: [PrismaModule, RolesModule],
  controllers: [ManagerApprovalsController],
  providers: [ManagerApprovalsService],
  exports: [ManagerApprovalsService],
})
export class ManagerApprovalsModule {}
