import { Module, Global } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DebugRoleContextModule } from '../../common/context/debug-role-context.module';

@Global()
@Module({
  imports: [PrismaModule, DebugRoleContextModule],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
