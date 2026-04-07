import { Module } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { DebugRoleContextModule } from '../../common/context/debug-role-context.module';

@Module({
  imports: [PrismaModule, DebugRoleContextModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
